# k6-WordPress-benchmarks


## Setup Instructions

### k6.io Cloud

You will need to login to k6.io and follow the instructions at [https://app.k6.io/tests/new/cli](https://app.k6.io/tests/new/cli)

After downloading k6 to your machine, it's important to login to cloud with the command:

```
k6 login cloud -t your-auth-token
```

In your options then make sure you set ```projectID``` and ```name``` inside the loadimpact section.

To execute cloud tests:

```k6 cloud script.js```

You may need to append options for the loadstorm.js and woocommerce.js. Specifically passing in the SITE_URL. This applies to cloud and local tests.

```k6 cloud script.js -e SITE_URL=https://example.com```


## static-cache-test.js 

This is the test used in [WordPress Hosting Performance Benchmarks](https://wphostingbenchmarks.com/) to see how well full page caching handles load. It is designed to scale from 1 - N concurrent users hammering a single page. This uses k6 Cloud to distribute load across 10 geographical zones.

Duration is how long the test scales up and target determines the number to scale to over the duration.

Make sure to change example.com to your test website. Also you can easily set custom headers to more easily identify the traffic you are generating.

## loadstorm.js

Please note: loadstorm.js requires SITE_URL environmental variable

This test is designed to simulate real users logging in, bypassing cache and browsing the website.

By default it is set to 1 VUser which will run for the duration iterating through the script. This is recommended for testing to make sure the script works locally before loading lots of users or paying for it to run in the cloud. You can use the same stages options which are commented out as an example of how to run the 20 minute ramp up from 1-1000 users over 20 minutes; and then maintain peak for 10 minutes with 1000 users.

### The Load Storm Setup

This script works by loading the sitemap (uses default WordPress sitemap: wp-sitemap.xml). If you use a plugin that alters the sitemap structure or location, this may cause issues. You will need to adjust where it is and possible adjust the code if the wpSitemap() function in lib/helpers.js cannot process it.

This script also filters author and category links. It was designed for a simple page/post test site and tries to focus on those. You can adapt this logic to fit your needs from removeAuthorCategoryLinks() function in lib/helpers.js.

Custom header can be set in the globalParams, I wouldn't recommend altering the jar unless you know what you are doing. This is the cookie jar designed to help handle cookies.

To test many users, I generate users following a 'baseusername' and then create accounts with numbers in sequence. baseusername1 - baseusername1000. Please adjust the usernameBase and usernameRange accordingly if you are going to use many users for logging in.

domainFilter - is an important variable because you probably don't want to load external resources on every page. You can easily add any domain to domainFilter to prevent anything on that domain from being loaded during the test.

pause - let's you set the range of time between page loads. To behave like a normal user browsing a website, there are delays between clicking to the next page. 

### The Load Storm Loop

The loadstorm.js goes through the following pages/behaviors:

* Load Homepage
* Go to wp-login
* Pass username/password credentials
* iterate through every page on the sitemap

On every page load the findNewAssets() function will run. This looks at the html and finds css/js/images that would normally be loaded by the page, and requests them. It also keeps track of all the assets it has already loaded this session and doesn't load assets it already loaded from other pages to replicate browsing caching behavior.

## woocommerce.js

This is very similar to loadstorm.js in configuration with one major exception: scenarios.

We use different scenarios to create multiple user patterns in the same test. woocommerce.js has 4 scenarios:

* Homepage (just visits the homepage)
* browser (visits homepage and clicks on some products)
* buyer (visits homepage, clicks on a product, adds to cart, checkout)
* customer (visits homepage, logins in, views order and account information)

Each scenario can be customized with its own users, duration, etc.

This was also written later and has a simpler system to handle getting pages. getPage() wraps a lot of the functionality you expect: getting the page, checking the response and error handling, adding metrics and handling the assets.