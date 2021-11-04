# k6-WordPress-benchmarks

## static-cache-test.js 

This is the test used in [WordPress Hosting Performance Benchmarks 2021](https://wphostingbenchmarks.com/) to see how well full page caching handles load. It is designed to scale from 1 - N concurrent users hammering a single page. This uses k6 Cloud to distribute load across 10 geographical zones.
