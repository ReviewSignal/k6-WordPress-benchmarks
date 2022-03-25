import http from 'k6/http'
import { fail } from 'k6'
import {parseHTML} from "k6/html";

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
            assets.push(item.attr("href"))
        }
    })

    //find all javascript
    doc.find("script").toArray().forEach(function (item) {
        if(item.attr("src") != undefined) {
            assets.push(item.attr("src"))
        }
    })

    //find all images
    doc.find("img").toArray().forEach(function (item) {

        if(item.attr("src") != undefined) {
            assets.push(item.attr("src"))
        }
    })

    return assets
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