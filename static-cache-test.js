//static cache test script used on WPHostingBenchmarks.com in 2020, 2021 tests
//This utilizes k6 Cloud to do load distribution across 10 load zones
//This ramps up from 1 to 1000 users over 15m in a single stage
//There is a 1 second delay between iterations [sleep(1)]
//This script simply requests one page (https://example.com)
//There is X-CustomHeader: 1 being passed to help bypass/log load testing connections

import { sleep } from 'k6'
import { Rate } from 'k6/metrics'
import http from 'k6/http'
import { setupEnvironment } from './lib/env.js'

//Override default values in setupEnvironment here
const defaultValues = {
  vusers: 1000,
  duration: '15m'
};
const {
  siteUrl,
  customHeaderName,
  customHeaderValue,
  vusers,
  duration
} = setupEnvironment([
  'siteUrl',
  'customHeader',
  'vusers',
  'duration'
], defaultValues);

// let's collect all errors in one metric
let errorRate = new Rate('error_rate')

// See https://k6.io/docs/using-k6/options
export let options = {
  batch: 1,
  throw: true,
  stages: [
    { duration: duration, target: vusers },
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
  let params = {
    headers: { 
      [customHeaderName]: customHeaderValue,
      "accept-encoding": "gzip, br, deflate",
    },
  };
  let res = http.get(siteUrl, params)

  errorRate.add(res.status >= 400)

  sleep(1)
}
