import http from 'k6/http'
import { check, fail } from 'k6'
import {parseHTML} from "k6/html";
import { isOK } from './checks.js'
import _ from 'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js'

export function rand (min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min)
}

export function sample (array) {
    const length = array.length

    return length
        ? array[~~(Math.random() * length)]
        : undefined
}

export function bypassPageCacheCookies () {
    return {
        comment_author_D00D2BAD: 'FEEDFACE',
        wordpress_logged_in_DEADFA11: 'FADEDEAD',
        woocommerce_cart_hash: 3405691582,
        wp_woocommerce_session_BADC0FFEE0DDF00D: 'DEADBEEF',
    }
}

export function wpSitemap (url) {
    const urls = []
    const response = http.get(url)

    if (response.status != 200) {
        fail('sitemap did *not* return 200 status')
    }

    response.html().find('sitemap loc').each(function (idx, el) {
        const response = http.get(el.innerHTML())

        response.html().find('url loc').each(function (idx, el) {
            urls.push(el.innerHTML())
        })
    })
    
    response.html().find('url loc').each(function (idx, el) {
            urls.push(el.innerHTML())
        })

    if (! urls.length) {
        fail('sitemap did *not* contain any urls')
    }

    return { urls }
}

export function wpMetrics (response) {
    if (! response.body) {
        return false
    }

    const comment = response.body.match(/<!-- plugin=object-cache-pro (.+?) -->/g)

    if (! comment) {
        return false
    }

    const toCamelCase = function (str) {
        return str.toLowerCase()
            .replace(/['"]/g, '')
            .replace(/\W+/g, ' ')
            .replace(/ (.)/g, ($1) => $1.toUpperCase())
            .replace(/ /g, '')
    }

    const metrics = [...comment[0].matchAll(/metric#([\w-]+)=([\d.]+)/g)]
        .reduce(function (map, metric) {
            map[toCamelCase(metric[1])] = metric[2]

            return map
        }, {})

    return metrics
}

export function responseWasCached (response) {
    const headers = Object.keys(response.headers).reduce(
        (c, k) => (c[k.toLowerCase()] = response.headers[k].toLowerCase(), c), {}
    )

    // Cloudflare
    if (headers['cf-cache-status'] === 'hit') {
        return true
    }

    // Generic proxy
    if (headers['x-proxy-cache'] === 'hit') {
        return true
    }

    // Litespeed
    if (headers['x-lsadc-cache'] === 'hit') {
        return true
    }

    //Fastly, KeyCDN, Akamai
    if (headers['x-cache'] === 'hit') {
        return true
    }

    //WPX CDN
    if (headers['x-cache-status'] === 'hit') {
        return true
    }

    //Gcore CDN
    if (headers['cache'] === 'hit') {
        return true
    }

    return false
}

/*
 *   Summary.     findNewAssets
 *   Description. finds new assets in a response object filters against assets and domain filter
 *
 *   @param response response     - k6 response object.
 *   @param array    assets       - array of asset URLs.
 *   @param array    domainFilter - array of domains to filter out.
 *   @return array                - array of asset urls not originally in assets
 */

export function findNewAssets(response, assets, domainFilter) {
    //load all secondary assets
    const doc = parseHTML(response.body)

    //find assets not already loaded (in our assets array)
    let newAssets = findAssets(doc).filter(x => !assets.includes(x))
    newAssets = filterAssetsArray(newAssets,domainFilter)

    return newAssets
}

/*
 *  Summary.     findAssets
 *  Description. Find assets in an HTML document. Currently supports css, js, images but not nested assets. There is no url validation which may cause errors
 *
 *  @param  string doc    - HTML document string
 *  @return array  assets - array of asset URLs
 */
export function findAssets(doc) {
    let assets = []

    //find all stylesheets
    doc.find("link[rel='stylesheet']").toArray().forEach(function (item) {
        if(item.attr("href") != undefined) {
            let url = checkHttpsProtocol(item.attr("href"))
            if (url) {
                //url = filterVersions(url)
                assets.push(url)
            }
        }
    })

    //find all javascript
    doc.find("script").toArray().forEach(function (item) {
        if(item.attr("src") != undefined) {
            let url = checkHttpsProtocol(item.attr("src"))
            if (url) {
                //url = filterVersions(url)
                assets.push(url)
            }
        }
    })

    //find all images
    doc.find("img").toArray().forEach(function (item) {

        if(item.attr("src") != undefined) {
            let url = checkHttpsProtocol(item.attr("src"))
            if (url) {
                //url = filterVersions(url)
                assets.push(url)
            }
        }
    })

    return assets
}

export function filterVersions(url) {
    if (url.indexOf('?ver=') > -1) {
        //strip ?ver=### from url
        url = url.split('?ver=')[0]
    }
    return url
}

/*
 *   Summary.     filterAssets
 *   Description. Filter an array of assets removing any matching the domain
 *
 *   @param  array   assets         - array of asset URLs.
 *   @param  array   domain         - domain to filter out.
 *   @return array   filteredAssets - array of filtered asset URLs
 */
//filter out domains from assets
export function filterAssets(assets, domain) {
    let filteredAssets = []
    assets.forEach(asset => {
        if (!asset.includes(domain)) {
            filteredAssets.push(asset)
        }
    })
    return filteredAssets
}

export function filterAssetsArray(assets, domainArray) {
    domainArray.forEach(domain => {
            assets = filterAssets(assets,domain)
    })
    return assets
}

/*
 *   Summary.     createBatchArrayFromURLArray
 *   Description. Creates an array for batch k6 calls
 *
 *   @param  array               urls           - array of URLs.
 *   @param  string              method         - HTTP method to use (GET/POST/...)
 *   @param  string|object|null  body           - (optional) body of request to send
 *   @params object|null         params         - (optional) parameters to send with request
 *   @return array               batchArray     - array of requests formatted for batch()
 */
export function createBatchArrayFromURLArray (urls,method,body=null,params=null) {
    let batchArray
    //create an array based on urls with method, url, body if not null and params if not null
    if (urls.length > 0) {
        batchArray = urls.map(url => {
            return [
                method,
                url,
                body,
                params
            ]
        })
    }
    return batchArray
}

/*
 *   Summary.     removeAuthorCategoryLinks
 *   Description. Removes author and category links from array of URLs (from sitemap)
 *
 *   @param  array   urls    - array of WordPress URLs.
 *   @return array   newUrls - array of URLs without author and category links
 */
export function removeAuthorCategoryLinks(urls) {
    let newUrls = []
    urls.forEach(url => {
        if (!url.includes('/author/') && !url.includes('/category/')) {
            newUrls.push(url)
        }
    })
    return newUrls
}

/*
 *   Summary.     debugObject
 *   Description. Pretty print an object to command line. Often for response objects which allow body removal for readability
 *
 *   @param  object   myobject    - Object to display
 *   @param  string   comment     - (Optional) Comment to append to debug output to help log readability
 *   @param  boolean  removeBody  - (Optional) remove body property of the object, helps make response objects much smaller and readable
 *   @return
 */
//pretty print an object (often a response), can leave optional comment to help find it in log, 
//you can optionally remove properties (eg. body) to make things manageable
export function debugObject(myobject, comment = '', removeBody = false) {
    let output
    if(removeBody){
        output = JSON.stringify(myobject,hideBody,2)
    }else{
        output = JSON.stringify(myobject,null,2)
    }
    console.log("\r\n["+comment+"][Object]:" + output)
}

/*
 *   Summary.     hideBody
 *   Description. replacer function to hide body property used by JSON.stringify
 */
export function hideBody(key, value) {
    if (key=="body") return undefined
    else return value
}

/*
 *   Summary.     generateUsername
 *   Description. Generates random username from base and adding a number between start and end
 *
 *   @param  string   usernameBase   - Username base
 *   @param  integer  start          - lowest number to add to username base
 *   @param  integer  end            - highest number to add to username base
 *   @return string   username       - full username with random number
 */
export function generateUsername(usernameBase, start, end) {
    //append a random number to the username base within start and end
    let randomNumber = Math.floor(Math.random() * (end - start + 1)) + start
    let username = usernameBase + randomNumber
    return username
}

//check if url has http or https before //
export function checkHttpsProtocol(url){
    if (url.startsWith('https://')) {
        return url
    } else if(url.startsWith('http://')) {
            //force https
            url = url.replace('http://', 'https://')
            return url
    } else {
        //check if it starts with //
        if (url.startsWith('//')) {
            //if it does, add https to the url
            url = 'https:' + url
            return url
        }
    }
    return false
}

export function getProducts(response, addToCart = false){
    
    const doc = response.html();
    // extract all of the available products using product class
    const allProducts = doc
      .find("li[class*=product]")
      .toArray();

    let products = allProducts.map(i => {
        //if we are looking for products to add to cart, we return empty object and filter it out later
        if(addToCart){
            if(i.children().get(1).textContent().toLowerCase() != ('add to cart')){
                return {}
            }
        }

        const link = i.children().get(0).getAttribute("href")
        const id = i.children().get(1).getAttribute("data-product_id")
        const sku = i.children().get(1).getAttribute("data-product_sku")
      return {
        id: id,
        sku: sku,
        link: link
      };
    });


    //remove empty products (that can't be added to cart)
    products = products.filter(i => Object.keys(i).length !== 0)

    products.forEach(i => {
      //console.log(`Product ID: '${i.id}' SKU: '${i.sku}' LINK: '${i.link}'`);
    });
    //debugObject(products)

    return products;
}

export function getRefreshedFragments(siteUrl, params) {
    const defaultHeaders = {
                accept: "*/*",
                "accept-encoding": "gzip, deflate",
                "accept-language": "en-US,en;q=0.9",
                connection: "keep-alive",
                "content-type":
                "application/x-www-form-urlencoded;type=content-type;mimeType=application/x-www-form-urlencoded",
            };
    const customParams = _.merge({}, defaultHeaders, params);
    const response = http.post(
        siteUrl + "?wc-ajax=get_refreshed_fragments",
        {
            time: Date.now(),
        },
        customParams
    );
    //debugObject(response,'getRefreshedFragments')
    return response;
}



export function getPage(url, data, metrics){ 
    //get the page
    let response = http.get(url, data.params)

    //handle checks/metrics
    check(response, isOK) || metrics.addErrorMetrics()
    metrics.addResponseMetrics(response)

    //load page assets
    getPageAssets(response,data, metrics)

    //in case you want to do anything further with response
    return response
}

export function getPageAssets(response,data, metrics) {
    //load all secondary assets
    let newAssets = findNewAssets(response,data.assets, data.domainFilter)

    //debugObject(newAssets,'NEW ASSETS!')

    //if we have new assets, requests them
    if(newAssets.length > 0){
        //load new assets
        let pageAssets = createBatchArrayFromURLArray(newAssets,'GET',null,data.params);

        let pageAssetResponses = http.batch(pageAssets);

        for (let key in pageAssetResponses) {
            check(pageAssetResponses[key], isOK) || metrics.addErrorMetrics()

            metrics.addResponseMetrics(pageAssetResponses[key])
        }

        //add new assets to our asset cache to make sure we don't load them again
        data.assets = [...data.assets, ...newAssets]

        //debugObject(assets,'Assets')

        //empty our new assets
        newAssets = [];
    }
}

export function addToCart(url,sku,id,quantity, data, metrics) {
    const defaultHeaders = {
                "content-type":
                "application/x-www-form-urlencoded;type=content-type;mimeType=application/x-www-form-urlencoded",
            };
    const customParams = _.merge({}, defaultHeaders, data.params);
    const response = http.post(
        url,
        {
            product_sku: sku,
            product_id: id,
            quantity: quantity,
        },
        customParams
    );
    //debugObject(response,'Add to Cart')
    
    //check response and add timing
    check(response, isOK) || metrics.addErrorMetrics()
    metrics.cartResponseTime.add(response.timings.duration)

    //check if response contains cart_hash object
    if(!response.json().cart_hash){
        //error
        metrics.cartFailure.add(1)
        fail('Failed to add to cart')
    }
    //console.log('Cart hash: ' + response.json().cart_hash)

    return response;
}