//static cache test script used on WPHostingBenchmarks.com in 2020, 2021 tests
//This utilizes k6 Cloud to do load distribution across 10 load zones
//This ramps up from 1 to 1000 users over 15m in a single stage
//There is a 1 second delay between iterations [sleep(1)]
//This script simply requests one page (https://example.com)
//There is X-CustomHeader: 1 being passed to help bypass/log load testing connections

import { sleep } from 'k6'
import { Rate } from 'k6/metrics'
import http from 'k6/http'

// let's collect all errors in one metric
let errorRate = new Rate('error_rate')

// See https://k6.io/docs/using-k6/options
export let options = {
  batch: 1,
  throw: true,
  stages: [//default is 15 minutes and 1000 VUsers
    { duration: __ENV.DURATION || '15m', target: parseInt(__ENV.VUSERS) || 1000 },
  ],
  ext: {
    loadimpact: {//For distributing load in k6 cloud
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
    },
  },
}

export default function () {
    //get custom header from command line parameter (CUSTOMHEADERNAME)
    let customHeaderName = __ENV.CUSTOMHEADERNAME
    if(customHeaderName == undefined) {
        //set a default CustomHeaderName instead or error out
        customHeaderName = 'X-CustomHeader';//default
        //or throw an error if we absolutely need a custom header name
        //throw new Error("Missing CUSTOMHEADERNAME variable")
    }

    //get custom header value from command line parameter (CUSTOMHEADERVALUE)
    let customHeaderValue = __ENV.CUSTOMHEADERVALUE
    if(customHeaderValue == undefined) {
        //set a default CustomHeaderValue instead or error out
        customHeaderValue = '1';//default
        //or throw an error if we absolutely need a custom header value
        //throw new Error("Missing CUSTOMHEADERVALUE variable")
    }
  let params = {
    headers: { 
      [customHeaderName]: customHeaderValue,
      "accept-encoding": "gzip, br, deflate",
    },
  };
  //get siteurl from command line parameter (-e TARGET=https://example.com/)
  let siteUrl = __ENV.TARGET
  if(siteUrl == undefined) {
      throw new Error("Missing TARGET variable")
  }
  //make sure we have trailing slash on the url
  const lastChar = siteUrl.substr(-1);
  if (lastChar != '/') {
     siteUrl = siteUrl + '/';
  }
  let res = http.get(siteUrl, params)

  errorRate.add(res.status >= 400)

  sleep(1)
}
