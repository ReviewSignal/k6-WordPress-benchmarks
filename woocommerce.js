import http from 'k6/http'
import { check, group, fail, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import {parseHTML} from "k6/html";

import { rand, sample, wpMetrics, wpSitemap, responseWasCached, bypassPageCacheCookies, findNewAssets, findAssets, filterAssets, filterAssetsArray, createBatchArrayFromURLArray, removeAuthorCategoryLinks, debugObject, generateUsername, checkHttpsProtocol, getProducts, getRefreshedFragments, getPage, getPageAssets, addToCart } from './lib/helpers.js'
import { isOK, wcIsNotLogin } from './lib/checks.js'
import _ from 'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js'


export const options = {
    scenarios: {
        homepage_scenario: {
            // name of the executor to use
            executor: 'ramping-vus',
            exec: 'homepage',

            startTime: '0s', //start at the beginning
            gracefulStop: '0s',
            gracefulRampDown: '0s',

            tags: { wc_scenario: 'homepage' },

            stages: [
                { duration: '40m', target: 500 },//ramp up to 500
                { duration: '20m', target: 500 },//stay at 500
            ],
        },
        browser_scenario: {
            // name of the executor to use
            executor: 'ramping-vus',
            exec: 'browser',

            startTime: '0s', //start at the beginning
            gracefulStop: '0s',
            gracefulRampDown: '0s',
            tags: { wc_scenario: 'browser' },

            stages: [
                { duration: '40m', target: 200 },
                { duration: '20m', target: 200 },
            ],
        },
        buyer_scenario: {
            // name of the executor to use
            executor: 'ramping-vus',
            exec: 'buyer',

            startTime: '0s', //start at the beginning
            gracefulStop: '0s',
            gracefulRampDown: '0s',
            tags: { wc_scenario: 'buyer' },

            stages: [
                { duration: '40m', target: 200 },
                { duration: '20m', target: 200 },
            ],
        },
        customer_scenario: {
            // name of the executor to use
            executor: 'ramping-vus',
            exec: 'customer',

            startTime: '0s', //start at the beginning
            gracefulStop: '0s',
            gracefulRampDown: '0s',
            tags: { wc_scenario: 'customer' },

            stages: [
                { duration: '40m', target: 100 },
                { duration: '20m', target: 100 },
            ],
        },
    },
    /*ext: {
        //for running k6.io cloud tests
        loadimpact: {
            projectID: 1234567890,
            // Test runs with the same name groups test runs together
            name: "WooCommerce",
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
    //get siteurl from command line parameter (-e SITE_URL=https://example.com/)
    let siteUrl = __ENV.SITE_URL
    if(siteUrl == undefined) {
        throw new Error("Missing SITE_URL variable")
    }
    //make sure we have trailing slash on the url
    const lastChar = siteUrl.substr(-1);
    if (lastChar != '/') {
       siteUrl = siteUrl + '/';
    }

    //setup cookie jar to use for VUser
    const jar = new http.CookieJar()

    //setup parameters to be sent with every request, eg. custom header and cookie jar
    const globalParams = {
        headers: { 
            'CustomHeader': 'NotADDoS',
            "accept-encoding": "gzip, br, deflate",
        },
        jar: {jar},
    };

    const usernameBase = 'username';
    //username range is appended to username base if it exists. randomly choosing a number to append within the range to usernameBase
    const usernameRange = {
                            start: 10,
                            end: 10010,
                          }
    const password = 'pass';//default

    const wpLogin = 'wp-login.php';

    const domainFilter = ['gravatar.com','wp.com','googleapis.com'];

    //set delay between pages
    const pause = {
        min: 5,
        max: 10,
    }

    let assets = [] //track all static asset urls

    return {  siteurl: siteUrl, params: globalParams, username: usernameBase, usernameRange: usernameRange, password: password, wplogin: wpLogin, domainFilter: domainFilter, pause: pause, assets: assets }
}

//setup our metrics to track
const errorRate = new Rate('errors')
const errorCount = new Counter('errorCounter')
const loginFailure = new Counter('loginFailureCounter')
const loginResponseTime = new Trend('LoginResponseTime')
const cartFailure = new Counter('cartFailureCounter')
const cartResponseTime = new Trend('CartResponseTime')
const pageResponseTime = new Trend('PageResponseTime')
const assetResponseTime = new Trend('AssetResponseTime')
const responseCacheRate = new Rate('response_cached')

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

export default function (data) {
    console.log("We shouldn't be here");
}

export function homepage (data) {
    let response
    group('Load homepage', function () {
        response = getPage(data.siteurl, data)
    })

    //get refreshed fragment
    const fragmentResponse = getRefreshedFragments(data.siteurl, data.params);

    check(fragmentResponse, isOK) || addErrorMetrics()
    addResponseMetrics(fragmentResponse)

    //delay between page views to emulate real user browsing the site
    sleep(rand(data.pause.min, data.pause.max))
    //in case you want to handle the responses generated
    return {
        homeResponse: response,
        fragmentResponse: fragmentResponse
    };

}

/*
 *  Customer Scenario
 *  Homepage, Login, view orders, view account details
 */
export function customer (data) {
    let homeObj = homepage(data) //load homepage

    group('Login', function () {
        //get my account page to login
        const response = getPage(`${data.siteurl}my-account/`,data)

        //submit username / password on form
        let user = generateUsername(data.username, data.usernameRange.start, data.usernameRange.end)
        const formResponse = response.submitForm({
            formSelector: 'form.woocommerce-form-login',
            params: data.params,
            fields: {
                username: user,
                password: data.password,
                rememberme: 'forever',
            },
        })

        //debugObject(formResponse,'FORM RESPONSE')

        check(formResponse, isOK) || addErrorMetrics()

        check(formResponse, wcIsNotLogin) || ( loginFailure.add(1) && fail('page *has* login form'))

        addResponseMetrics(formResponse)
        loginResponseTime.add(formResponse.timings.duration)

        //load login page assets
        getPageAssets(formResponse,data)
    })

    sleep(rand(data.pause.min, data.pause.max))

    group('Load orders', function () {
        const response = getPage(`${data.siteurl}my-account/orders/`,data)
    })

    sleep(rand(data.pause.min, data.pause.max))

    group('View Account Details', function () {
        const response = getPage(`${data.siteurl}my-account/edit-account/`,data)
        //debugObject(response,'View Account Details')
    })

    sleep(rand(data.pause.min, data.pause.max))
}

/*
 *  Browser Scenario
 *  Homepage, view five random products
 */
export function browser (data) {
    let homeObj = homepage(data) //load homepage

    let products = getProducts(homeObj.homeResponse)

    //visit 5 random product pages
    group('product', function () {
        for (let i = 0; i <5; i++) {
            const product = sample(products)

            let pageResponse = getPage(product.link, data)

            //debugObject(pageResponse,'PAGE RESPONSE:')

            sleep(rand(data.pause.min, data.pause.max))
        }
    })
}

/*
 *  Buyer Scenario
 *  Homepage, add item to cart, to go cart, checkout
 */
export function buyer (data) {
    let homeObj = homepage(data) //load homepage

    //choose random product to add to cart from homepage
    let products = getProducts(homeObj.homeResponse, true)
    const product = sample(products)

    group('Add to cart', function () {
        //add product to cart
        const cartResponse = addToCart(data.siteurl + '?wc-ajax=add_to_cart', product.sku, product.id, 1, data)

        sleep(rand(data.pause.min, data.pause.max))
    })

    group('Go to cart', function () {
        //go to cart
        const goCartResponse = getPage(data.siteurl + 'cart/',data)

        sleep(rand(data.pause.min, data.pause.max))
    })

    group('Go to checkout', function () {
        //go to checkout
        const checkoutResponse = getPage(data.siteurl + 'checkout/',data)

        sleep(rand(data.pause.min, data.pause.max))
    })

}