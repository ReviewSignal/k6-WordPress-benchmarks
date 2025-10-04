import http from 'k6/http'
import { check, group, fail, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import {parseHTML} from "k6/html";
import { setupEnvironment } from './lib/env.js';
import { rand, sample, wpMetrics, wpSitemap, responseWasCached, bypassPageCacheCookies, findNewAssets, findAssets, filterAssets, filterAssetsArray, createBatchArrayFromURLArray, removeAuthorCategoryLinks, debugObject, generateUsername, checkHttpsProtocol } from './lib/helpers.js'
import { isOK, wpIsNotLogin } from './lib/checks.js'
import _ from 'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js'
import Metrics from './lib/metrics.js';

//Override default values in setupEnvironment here
const defaultValues = {
    customHeaderName: 'X-OrderlyApe',
  };
const {
    siteUrl,
    password,
    usernameBase,
    usernameRange,
    customHeaderName,
    customHeaderValue,
    wpLogin,
    domainFilter,
    pause,
    vusers,
    duration
} = setupEnvironment([
    'siteUrl',
    'password',
    'usernameBase',
    'usernameRange',
    'customHeader',
    'wpLogin',
    'domainFilter',
    'pause',
    'vusers',
    'duration'
], defaultValues);

export const options = {
    //userAgent: 'OrderlyApe/1.0',
    //vus: vusers,
    //duration: duration,
    
    // vus, duration - can be replaced with stages
    // the following mimics old Load Storm test
    // it ramps up to target over 20 minutes
    // then holds at peak (target) for 10 minutes

    stages: [
        { duration: '20m', target: vusers }, // simulate ramp-up of traffic from 1 to vusers over 20 minutes.
        { duration: '10m', target: vusers }, // stay at max vusers for 10 minutes
    ],
    
    /*ext: {
        //for running k6.io cloud tests
        loadimpact: {
            projectID: 123456789,//put your project ID for k6 here
            name: "loadstorm test" //test name, tests with the same name group together
            
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
            
        }
    }*/
}

//setup executes once at the start and passes data to the main function (default) which a VUser executes
export function setup () {


    //get sitemap of the site to browse
    let sitemap = wpSitemap(`${siteUrl}wp-sitemap.xml`)
    //filter Author / Category links leaving only posts/pages by default
    sitemap = removeAuthorCategoryLinks(sitemap.urls)

    //setup cookie jar to use for VUser
    const jar = new http.CookieJar()

    //setup parameters to be sent with every request, eg. custom header and cookie jar
    const globalParams = {
        headers: { 
            [customHeaderName]: customHeaderValue,
            "accept-encoding": "gzip, br, deflate",
        },
        jar: {jar},
    };


    return { urls: sitemap, siteurl: siteUrl, params: globalParams, username: usernameBase, usernameRange: usernameRange, password: password, wplogin: wpLogin, domainFilter: domainFilter, pause: pause }
}

const metrics = new Metrics()

export default function (data) {
    //setup URL to test (must be passed from command line with -e SITE_URL=https://example.com)
    const siteUrl = data.siteurl

    if (!data.params.jar || typeof data.params.jar.cookiesForURL !== 'function') {
        data.params.jar = new http.CookieJar()
    }

    let assets = [] //track all static asset urls
    let newAssets = [] //used to track new assets we need to load before they are cached by the browser
    const pause = data.pause


    //setup bypass cache cookies if option enabled
    if (__ENV.BYPASS_CACHE) {
        Object.entries(bypassPageCacheCookies()).forEach(([key, value]) => {
            data.params.jar.set(siteUrl, key, value, { path: '/' })
        })
    }


    /*
        Load Homepage
    */
    group('Load homepage', function () {
        const response = http.get(siteUrl, data.params)

        check(response, isOK)
            || metrics.addErrorMetrics()

        metrics.addResponseMetrics(response)

        //debugObject(response,'Homepage',true);

        newAssets = findNewAssets(response,assets, data.domainFilter, metrics)

        //load new assets
        if(newAssets.length > 0){
            let pageAssets = createBatchArrayFromURLArray(newAssets,'GET',null,data.params);

            //debugObject(pageAssets,'HomeAssets');

            let pageAssetResponses = http.batch(pageAssets);

            for (let key in pageAssetResponses) {
                check(pageAssetResponses[key], isOK)
                    || metrics.addErrorMetrics()

                metrics.addResponseMetrics(pageAssetResponses[key])
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
            || metrics.addErrorMetrics()

        metrics.addResponseMetrics(response)

        //debugObject(response,'Login Form Page',true)

        //load secondary assets
        newAssets = findNewAssets(response,assets, data.domainFilter, metrics, metrics)

        //load new assets
        if(newAssets.length > 0){
            let pageAssets = createBatchArrayFromURLArray(newAssets,'GET',null,data.params);

            //debugObject(pageAssets,'LoginAssets');

            let pageAssetResponses = http.batch(pageAssets);

            for (let key in pageAssetResponses) {
                check(pageAssetResponses[key], isOK)
                    || metrics.addErrorMetrics()

                metrics.addResponseMetrics(pageAssetResponses[key])
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
        
        const customParams = {
            ...data.params,
            headers: {
                ...(data.params.headers || {}),
                ...loginHeaders.headers,
            },
            jar: data.params.jar,
        };

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
        const loginErrorMessage = formResponse.html().find('#login_error').text().replace(/\s+/g, ' ').trim()
        if (loginErrorMessage) {
            console.log(`Login error (${user}): ${loginErrorMessage}`)
        }
        if (!wpIsNotLogin['page is not login'](formResponse)) {
            console.log(`Login form still present for ${user}. Status: ${formResponse.status} URL: ${formResponse.url}`)
        }
        //debugObject(customParams,'Custom Login Params')
        //debugObject(formResponse,'Login Form Response',true)

        check(formResponse, isOK)
            || metrics.addErrorMetrics()
        //make sure the login form doesn't appear again indicating a failure
        check(formResponse, wpIsNotLogin)
            || ( metrics.loginFailure.add(1) && fail('page *has* login form'))

        const isCorrectUser = (response) => {
            const displayNameSelection = response.html().find('.display-name');
            const usernameSelection = response.html().find('.username');

            const displayName = displayNameSelection.first().text().trim();
            const usernameText = usernameSelection.first().text().trim();
            const resolvedIdentity = displayName || usernameText;
            const isMatch = resolvedIdentity === user;

            if (!isMatch) {
                console.log(
                    `Login user mismatch for ${user}: expected "${user}" but display-name="${displayName}" username="${usernameText}" (combined display-name text: "${displayNameSelection.text().trim()}", combined username text: "${usernameSelection.text().trim()}", display-name elements: ${displayNameSelection.size()}, username elements: ${usernameSelection.size()}, status: ${response.status}, url: ${response.url})`
                );
            }

            return isMatch;
        };

        //verify we are logged in as the correct user
        check(formResponse, {
            'logged in as correct user': (response) => isCorrectUser(response),
        }) || ( metrics.loginFailure.add(1) && fail('logged in as wrong user'))
        


        metrics.addResponseMetrics(formResponse)
        metrics.loginResponseTime.add(formResponse.timings.duration)

        newAssets = findNewAssets(formResponse,assets, data.domainFilter, metrics)

        //load new assets
        if(newAssets.length > 0){
            let pageAssets = createBatchArrayFromURLArray(newAssets,'GET',null,data.params);

            //debugObject(pageAssets,'Logged in Assets');

            let pageAssetResponses = http.batch(pageAssets);

            for (let key in pageAssetResponses) {
                check(pageAssetResponses[key], isOK)
                    || metrics.addErrorMetrics()

                metrics.addResponseMetrics(pageAssetResponses[key])
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
                || metrics.addErrorMetrics()
            metrics.addResponseMetrics(response)

            debugObject(response,'Page '+pageCounter,true)

            //load all secondary assets
            newAssets = findNewAssets(response,assets, data.domainFilter, metrics)

            //if we have new assets, requests them
            if(newAssets.length > 0){
                //load new assets
                let pageAssets = createBatchArrayFromURLArray(newAssets,'GET',null,data.params);
                
                //debugObject(pageAssets,'Page '+pageCounter+' Assets')

                let pageAssetResponses = http.batch(pageAssets);

                for (let key in pageAssetResponses) {
                    check(pageAssetResponses[key], isOK)
                        || metrics.addErrorMetrics()

                    metrics.addResponseMetrics(pageAssetResponses[key])
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
