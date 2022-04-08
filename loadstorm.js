import http from 'k6/http'
import { check, group, fail, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import {parseHTML} from "k6/html";

import { rand, sample, wpMetrics, wpSitemap, responseWasCached, bypassPageCacheCookies, findNewAssets, findAssets, filterAssets, filterAssetsArray, createBatchArrayFromURLArray, removeAuthorCategoryLinks, debugObject, generateUsername, checkHttpsProtocol } from './lib/helpers.js'
import { isOK, wpIsNotLogin } from './lib/checks.js'
import _ from 'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js'


export const options = {
    vus: 1,
    duration: '60s',
    /*
    // vus, duration - can be replaced with stages
    // the following mimics old Load Storm test
    // it ramps up to target over 20 minutes
    // then holds at peak (target) for 10 minutes
    stages: [
        { duration: '20m', target: 1000 }, // simulate ramp-up of traffic from 1 to 1000 users over 20 minutes.
        { duration: '10m', target: 1000 }, // stay at max load for 10 minutes
    ],
    */
    ext: {
        //for running k6.io cloud tests
        loadimpact: {
            projectID: 123456789,//put your project ID for k6 here
            name: "loadstorm test" //test name, tests with the same name group together
            /*
            //Optional Geo-Distribution of load test for cloud execution
            distribution: {
                Virginia: { loadZone: 'amazon:us:ashburn', percent: 10 },
                London: { loadZone: 'amazon:gb:london', percent: 10 },
                Frankfurt: { loadZone: 'amazon:de:frankfurt', percent: 10 },
                Oregon: { loadZone: 'amazon:us:portland', percent: 10 },
                Ohio: { loadZone: 'amazon:us:columbus', percent: 10 },
                Tokyo: { loadZone: 'amazon:jp:tokyo', percent: 10 },
                Sydney: { loadZone: 'amazon:au:sydney', percent: 10 },
                Mumbai: { loadZone: 'amazon:in:mumbai', percent: 10 },
                Singapore: { loadZone: 'amazon:sg:singapore', percent: 10 },
                Brazil: { loadZone: 'amazon:br:sao paulo', percent: 10 },
            },
            */
        }
    }
}

//setup executes once at the start and passes data to the main function (default) which a VUser executes
export function setup () {
    //get siteurl from command line parameter
    let siteUrl = __ENV.SITE_URL
    if(siteUrl == undefined) {
        throw new Error("Missing SITE_URL variable")
    }
    //make sure we have trailing slash on the url
    const lastChar = siteUrl.substr(-1);
    if (lastChar != '/') {
       siteUrl = siteUrl + '/';
    }

    //get sitemap of the site to browse
    let sitemap = wpSitemap(`${siteUrl}wp-sitemap.xml`)
    //filter Author / Category links leaving only posts/pages by default
    sitemap = removeAuthorCategoryLinks(sitemap.urls)

    //setup cookie jar to use for VUser
    const jar = new http.CookieJar()

    //setup parameters to be sent with every request, eg. custom header and cookie jar
    const globalParams = {
        headers: { 'X-CustomHeader': '1' },
        jar: {jar},
    };

    const usernameBase = 'testuser';
    //username range is appended to username base if it exists. randomly choosing a number to append within the range to usernameBase
    const usernameRange = {
                            start: 1,
                            end: 5,
                          }
    const password = 'password';

    const wpLogin = 'wp-login.php';

    const domainFilter = ['gravatar.com'];

    //set delay between pages
    const pause = {
        min: 5,
        max: 10,
    }

    return { urls: sitemap, siteurl: siteUrl, params: globalParams, username: usernameBase, usernameRange: usernameRange, password: password, wplogin: wpLogin, domainFilter: domainFilter, pause: pause }
}

//setup our metrics to track
const errorRate = new Rate('errors')
const errorCount = new Counter('errorCounter')
const loginFailure = new Counter('loginFailureCounter')
const loginResponseTime = new Trend('LoginResponseTime')
const pageResponseTime = new Trend('PageResponseTime')
const assetResponseTime = new Trend('AssetResponseTime')
const responseCacheRate = new Rate('response_cached')

export default function (data) {
    //setup URL to test (must be passed from command line with -e SITE_URL=https://example.com)
    const siteUrl = data.siteurl
    let assets = [] //track all static asset urls
    let newAssets = [] //used to track new assets we need to load before they are cached by the browser
    const pause = data.pause


    //setup bypass cache cookies if option enabled
    if (__ENV.BYPASS_CACHE) {
        Object.entries(bypassPageCacheCookies()).forEach(([key, value]) => {
            data.params.jar.set(siteUrl, key, value, { path: '/' })
        })
    }

    //add any custom metrics based on the response
    const addResponseMetrics = (response) => {
        //check if response was cached (cloudflare, litespeed, generic proxy support)
        responseCacheRate.add(responseWasCached(response))
        //add successful request to error rate
        errorRate.add(0)

        //check if we have text/html content (page) or not (asset)
        if('content-type' in response.headers && response.headers['content-type'].includes('text/html')){
            pageResponseTime.add(response.timings.duration)
        }else if('Content-Type' in response.headers && response.headers['Content-Type'].includes('text/html')){
            pageResponseTime.add(response.timings.duration)
        }else{
            assetResponseTime.add(response.timings.duration)
        }
    }

    //log all errors for normal requests
    const addErrorMetrics = () => {
        errorRate.add(1)
        errorCount.add(1)
        fail('status code was *not* 200')
    }


    /*
        Load Homepage
    */
    group('Load homepage', function () {
        const response = http.get(siteUrl, data.params)

        check(response, isOK)
            || addErrorMetrics()

        addResponseMetrics(response)

        //debugObject(response,'Homepage',true);

        newAssets = findNewAssets(response,assets, data.domainFilter)

        //load new assets
        if(newAssets.length > 0){
            let pageAssets = createBatchArrayFromURLArray(newAssets,'GET',null,data.params);

            //debugObject(pageAssets,'HomeAssets');

            let pageAssetResponses = http.batch(pageAssets);

            for (let key in pageAssetResponses) {
                check(pageAssetResponses[key], isOK)
                    || addErrorMetrics()

                addResponseMetrics(pageAssetResponses[key])
                //debugObject(pageAssetResponses[key],'Home Asset response '+key, true)
            }

            //add new assets to our asset cache to make sure we don't load them again
            assets = [...assets, ...newAssets]

            //debugObject(assets,'Assets');

            //empty our new assets
            newAssets = [];
        }


    })

    //delay between page views to emulate real user browsing the site
    sleep(rand(pause.min, pause.max))

    /*
        Login to WordPress
    */
    group('Login', function () {
        const response = http.get(`${siteUrl}${data.wplogin}`, data.params)

        check(response, isOK)
            || addErrorMetrics()

        addResponseMetrics(response)

        //debugObject(response,'Login Form Page',true)

        //load secondary assets
        newAssets = findNewAssets(response,assets, data.domainFilter)

        //load new assets
        if(newAssets.length > 0){
            let pageAssets = createBatchArrayFromURLArray(newAssets,'GET',null,data.params);

            //debugObject(pageAssets,'LoginAssets');

            let pageAssetResponses = http.batch(pageAssets);

            for (let key in pageAssetResponses) {
                check(pageAssetResponses[key], isOK)
                    || addErrorMetrics()

                addResponseMetrics(pageAssetResponses[key])
                //debugObject(pageAssetResponses[key],'Login Asset response '+key, true)
            }

            //add new assets to our asset cache to make sure we don't load them again
            assets = [...assets, ...newAssets]

            //debugObject(assets,'Assets');

            //empty our new assets
            newAssets = [];
        }

        //delay between page views to emulate real user browsing the site
        sleep(rand(pause.min, pause.max))

        //get form parameters from login page
        const vars = {}
        vars['redirect_to'] = response.html().find('input[name=redirect_to]').first().attr('value')
        vars['testcookie'] = response.html().find('input[name=testcookie]').first().attr('value')

        //add in our own extra headers for login
        const loginHeaders = {
            headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                    referer: `${siteUrl}${data.wplogin}`, //you must pass a referer, otherwise it breaks, doesn't matter what you send it seems though
            }
        }
        
        const customParams = _.merge({}, data.params, loginHeaders);

        let user = generateUsername(data.username, data.usernameRange.start, data.usernameRange.end)

        console.log('Username: ' + user)

        let formResponse = http.post(
            `${siteUrl}${data.wplogin}`,
            {
                log: `${user}`,
                pwd: `${data.password}`,
                rememberme: 'forever',
                'wp-submit': 'Log+In',
                redirect_to: `${vars['redirect_to']}`,
                //redirect_to: `${siteUrl}wp-admin/`, //sometimes the value doesn't work and we hard code (anything seems to actually work here oddly)
                testcookie: `${vars['testcookie']}`,
            },
            customParams

        )
        debugObject(customParams,'Custom Login Params')
        debugObject(formResponse,'Login Form Response',true)

        check(formResponse, isOK)
            || addErrorMetrics()
        //make sure the login form doesn't appear again indicating a failure
        check(formResponse, wpIsNotLogin)
            || ( loginFailure.add(1) && fail('page *has* login form'))


        addResponseMetrics(formResponse)
        loginResponseTime.add(formResponse.timings.duration)

        newAssets = findNewAssets(formResponse,assets, data.domainFilter)

        //load new assets
        if(newAssets.length > 0){
            let pageAssets = createBatchArrayFromURLArray(newAssets,'GET',null,data.params);

            //debugObject(pageAssets,'Logged in Assets');

            let pageAssetResponses = http.batch(pageAssets);

            for (let key in pageAssetResponses) {
                check(pageAssetResponses[key], isOK)
                    || addErrorMetrics()

                addResponseMetrics(pageAssetResponses[key])
                //debugObject(pageAssetResponses[key],'Logged in Asset response '+key, true)
            }

            //add new assets to our asset cache to make sure we don't load them again
            assets = [...assets, ...newAssets]

            //debugObject(assets,'Assets');

            //empty our new assets
            newAssets = [];
        }

    })


    sleep(rand(pause.min, pause.max))


    /* 
        browse site based on sitemap
    */

    //for each url create a group, run k6 request, check responses
    let pageCounter = 1;
    data.urls.forEach(url => {
        group('page'+pageCounter, function () {
            console.log("\r\n\r\nBrowsing page "+ pageCounter + ' | url: ' + url)
            //load the page and check the response and log metrics
            let response = http.get(url, data.params)
            check(response, isOK)
                || addErrorMetrics()
            addResponseMetrics(response)

            debugObject(response,'Page '+pageCounter,true)

            //load all secondary assets
            newAssets = findNewAssets(response,assets, data.domainFilter)

            //if we have new assets, requests them
            if(newAssets.length > 0){
                //load new assets
                let pageAssets = createBatchArrayFromURLArray(newAssets,'GET',null,data.params);
                
                //debugObject(pageAssets,'Page '+pageCounter+' Assets')

                let pageAssetResponses = http.batch(pageAssets);

                for (let key in pageAssetResponses) {
                    check(pageAssetResponses[key], isOK)
                        || addErrorMetrics()

                    addResponseMetrics(pageAssetResponses[key])
                    //debugObject(pageAssetResponses[key],'Page Asset response '+key,true)
                }

                //add new assets to our asset cache to make sure we don't load them again
                assets = [...assets, ...newAssets]

                //debugObject(assets,'Assets')

                //empty our new assets
                newAssets = [];
            }
        })
        pageCounter++;
        sleep(rand(pause.min, pause.max))

    })
}
