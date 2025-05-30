# k6-WordPress-benchmarks


# k6 WordPress Benchmarks

This collection of scripts were written to run the [WordPress Hosting Performance Benchmarks](https://wphostingbenchmarks.com). They are built to test different aspects of WordPress performance at scale utilizing the open source [k6](https://github.com/grafana/k6) load testing library.

There are three main scripts:

[static-cache-test.js](#static-cache-testjs) - Static Cache Testing

[loadstorm.js](#loadstormjs) - Standard WordPress Test

[woocommerce.js](#woocommercejs) - WooCommerce Test

## Setup Instructions

### Orderly Ape Setup

These scripts are designed to be compatible with [Orderly Ape](https://github.com/ReviewSignal/orderly-ape), an open source k6 cloud alternative.

Orderly Ape is configured from your Orderly Ape web app. All scaling and distribution options are configured there. Script options can be passed as environmental variables or hard coded into the scripts themselves. Running tests from Orderly Ape requires initiating them from the web app.

### k6.io Cloud Setup

You will need to login to k6.io and follow the instructions at [https://app.k6.io/tests/new/cli](https://app.k6.io/tests/new/cli)

After downloading k6 to your machine, it's important to login to cloud with the command:

```
k6 login cloud -t your-auth-token
```

In your options then make sure you set ```projectID``` and ```name``` inside the loadimpact section.

To execute cloud tests:

```k6 cloud script.js```

You mill need to append options for all the scripts. Specifically passing in the SITE_URL. This applies to cloud and local tests.

```k6 cloud script.js -e SITE_URL=https://example.com```

### Script Configuration Options

These scripts use a flexible configuration system with three levels of variable precedence:

1. **Environment Variables** (highest priority) - Passed via `-e` flag or system environment
2. **Default Values** (medium priority) - Set in the `defaultValues{}` object at the top of each script
3. **Built-in Defaults** (lowest priority) - Hardcoded fallbacks in `lib/env.js`

Environment variables will always override default values, and default values will override built-in defaults. This allows you to customize scripts for your specific testing needs while maintaining sensible defaults.

You can check `lib/env.js` to understand how these are handled and see all available built-in defaults.

**Configuration Priority Example:**
```javascript
// In script: defaultValues = { vusers: 500 }
// Built-in default: 1
// Command: k6 run script.js -e VUSERS=1000
// Result: Uses 1000 (environment variable wins)
```

**Note on Variable vs Environmental Variables**

Please remember to use environmental variable names, not variable names, when passing in parameters by command line (or Orderly Ape). The different names are partially legacy code and partially readability reasons.

## static-cache-test.js 



This is the test used in [WordPress Hosting Performance Benchmarks](https://wphostingbenchmarks.com/) to see how well full page caching handles load. It is designed to scale from 1 - N concurrent users hammering a single page. It has the options to use k6 Cloud to distribute load across 10 geographical zones.

Duration is how long the test scales up and target determines the number to scale to over the duration.

Make sure to change example.com to your test website. Also you can easily set custom headers to more easily identify the traffic you are generating.

### Configuration Variables

| Variable | Environment Variable | Default Value | Description |
|----------|---------------------|---------------|-------------|
| `siteUrl` | `TARGET` | **Required** | The target website URL to test (automatically adds trailing slash) |
| `customHeaderName` | `CUSTOMHEADERNAME` | `X-CustomHeader` | Name of the custom header to identify test traffic |
| `customHeaderValue` | `CUSTOMHEADERVALUE` | `1` | Value of the custom header |
| `vusers` | `VUSERS` | `1000` | Maximum number of virtual users to scale to |
| `duration` | `DURATION` | `15m` | Duration for scaling up to target users |

### Usage Examples

**Basic usage with required variable:**
```bash
k6 run static-cache-test.js -e TARGET=https://example.com
```

**Cloud execution with custom settings:**
```bash
k6 cloud static-cache-test.js -e TARGET=https://example.com -e VUSERS=500 -e DURATION=10m
```

**With custom headers for traffic identification:**
```bash
k6 run static-cache-test.js -e TARGET=https://example.com -e CUSTOMHEADERNAME=X-LoadTest -e CUSTOMHEADERVALUE=benchmark-2024
```

## loadstorm.js

This test is designed to simulate real users logging in, bypassing cache and browsing the website.

By default it is set to 1 VUser which will run for the duration, iterating through the script. This is recommended for testing to make sure the script works locally before loading lots of users or paying for it to run in the cloud or generate significant load on a website. It uses stages to ramp up to `vusers` over 20 minute, and then maintains the peak for 10 minutes with `vusers`. You can edit the staging to match your testing needs.

### Configuration Variables

| Variable | Environment Variable | Default Value | Description |
|----------|---------------------|---------------|-------------|
| `siteUrl` | `TARGET` | **Required** | The target website URL to test (automatically adds trailing slash) |
| `password` | `WPPASSWORD` | **Required** | WordPress password for user authentication |
| `usernameBase` | `WPUSERNAME` | **Required** | Base username for generating test accounts |
| `usernameRange.start` | `WPUSERNAMERANGESTART` | **Required** | Starting number for username range (e.g., user1) |
| `usernameRange.end` | `WPUSERNAMERANGEEND` | **Required** | Ending number for username range (e.g., user1000) |
| `customHeaderName` | `CUSTOMHEADERNAME` | `X-OrderlyApe` | Name of the custom header to identify test traffic |
| `customHeaderValue` | `CUSTOMHEADERVALUE` | `1` | Value of the custom header |
| `wpLogin` | `WPLOGIN` | `wp-login.php` | WordPress login page path |
| `domainFilter` | `DOMAINFILTER` | `gravatar.com,googleapis.com,stats.wp.com` | Comma-separated domains to exclude from asset loading |
| `pause.min` | `MINPAUSE` | `5` | Minimum seconds to pause between page loads |
| `pause.max` | `MAXPAUSE` | `10` | Maximum seconds to pause between page loads |
| `vusers` | `VUSERS` | `1` | Maximum number of virtual users to scale to |


### Usage Examples

**Basic usage with required variables:**
```bash
k6 run loadstorm.js -e TARGET=https://example.com -e WPUSERNAME=testuser -e WPPASSWORD=testpass -e WPUSERNAMERANGESTART=1 -e WPUSERNAMERANGEEND=100
```

**Cloud execution with custom settings:**
```bash
k6 cloud loadstorm.js -e TARGET=https://example.com -e WPUSERNAME=testuser -e WPPASSWORD=testpass -e WPUSERNAMERANGESTART=1 -e WPUSERNAMERANGEEND=500 -e VUSERS=500 -e MINPAUSE=3 -e MAXPAUSE=8
```

**With custom domain filtering:**
```bash
k6 run loadstorm.js -e TARGET=https://example.com -e WPUSERNAME=testuser -e WPPASSWORD=testpass -e WPUSERNAMERANGESTART=1 -e WPUSERNAMERANGEEND=10 -e DOMAINFILTER=gravatar.com,googleapis.com,facebook.com
```

### How LoadStorm Works

**Setup Process:**
- Loads the WordPress sitemap (`wp-sitemap.xml`) to discover all pages. **Note**: wp-sitemap.xml won't show up if you hide the site from search engines and SEO plugins may create alternative sitemaps.
- Filters out author and category links, focusing on posts and pages
- Create user accounts following the pattern: `{usernameBase}{number}` (e.g., testuser1, testuser2, etc.)

**Test Flow:**
1. Load Homepage
2. Navigate to wp-login page
3. Authenticate with WordPress credentials
4. Iterate through every page in the sitemap (wp-sitemap.xml)

**Asset Loading:**
The `findNewAssets()` function analyzes each page's HTML to discover CSS, JavaScript, and images that would normally be loaded by a browser. It maintains a cache of previously loaded assets to simulate realistic browser caching behavior, only loading new assets on subsequent pages.

**Domain Filtering:**
Use `domainFilter` to exclude external resources (like social media widgets, analytics, etc.) that you don't want to load during testing, focusing the test on your server's performance.

## woocommerce.js

This is very similar to loadstorm.js in configuration with one major exception: scenarios.

We use different scenarios to create multiple user patterns in the same test. woocommerce.js has 4 scenarios:

* Homepage (just visits the homepage)
* browser (visits homepage and clicks on some products)
* buyer (visits homepage, clicks on a product, adds to cart, checkout)
* customer (visits homepage, logins in, views order and account information)

Each scenario can be customized with its own users, duration, etc.

This was also written after `loadstorm.js` and has a simpler system to handle getting pages. getPage() wraps a lot of the functionality you expect: getting the page, checking the response and error handling, adding metrics and handling the assets.

### Configuration Variables

| Variable | Environment Variable | Default Value | Description |
|----------|---------------------|---------------|-------------|
| `siteUrl` | `TARGET` | **Required** | The target website URL to test (automatically adds trailing slash) |
| `password` | `WPPASSWORD` | **Required** | WordPress password for user authentication |
| `usernameBase` | `WPUSERNAME` | **Required** | Base username for generating test accounts |
| `usernameRange.start` | `WPUSERNAMERANGESTART` | **Required** | Starting number for username range (e.g., user1) |
| `usernameRange.end` | `WPUSERNAMERANGEEND` | **Required** | Ending number for username range (e.g., user1000) |
| `customHeaderName` | `CUSTOMHEADERNAME` | `X-OrderlyApe` | Name of the custom header to identify test traffic |
| `customHeaderValue` | `CUSTOMHEADERVALUE` | `1` | Value of the custom header |
| `wpLogin` | `WPLOGIN` | `wp-login.php` | WordPress login page path |
| `domainFilter` | `DOMAINFILTER` | `gravatar.com,googleapis.com,stats.wp.com` | Comma-separated domains to exclude from asset loading |
| `pause.min` | `MINPAUSE` | `5` | Minimum seconds to pause between page loads |
| `pause.max` | `MAXPAUSE` | `10` | Maximum seconds to pause between page loads |
| `vusersHome` | `VUSERSHOME` | `500` | Virtual users for homepage scenario |
| `vusersBrowser` | `VUSERSBROWSER` | `200` | Virtual users for browser scenario |
| `vusersBuyer` | `VUSERSBUYER` | `200` | Virtual users for buyer scenario |
| `vusersCustomer` | `VUSERSCUSTOMER` | `100` | Virtual users for customer scenario |

### Scenario Details

**Homepage Scenario (`vusersHome`):**
- Simply visits the homepage repeatedly
- Simulates users landing on your site

**Browser Scenario (`vusersBrowser`):**
- Visits homepage and browses products
- Simulates window shopping behavior

**Buyer Scenario (`vusersBuyer`):**
- Complete purchase flow: homepage → product → add to cart → checkout
- Tests the full e-commerce conversion funnel (without actual payment)

**Customer Scenario (`vusersCustomer`):**
- Authenticated user behavior: login → view orders → account management
- Tests logged-in user experience

### Usage Examples

**Basic usage with required variables:**
```bash
k6 run woocommerce.js -e TARGET=https://example.com -e WPUSERNAME=testuser -e WPPASSWORD=testpass -e WPUSERNAMERANGESTART=1 -e WPUSERNAMERANGEEND=100
```

**Customizing scenario user counts:**
```bash
k6 run woocommerce.js -e TARGET=https://example.com -e WPUSERNAME=testuser -e WPPASSWORD=testpass -e WPUSERNAMERANGESTART=1 -e WPUSERNAMERANGEEND=1000 -e VUSERSHOME=1000 -e VUSERSBROWSER=300 -e VUSERSBUYER=300 -e VUSERSCUSTOMER=150
```

**Cloud execution with custom settings:**
```bash
k6 cloud woocommerce.js -e TARGET=https://example.com -e WPUSERNAME=testuser -e WPPASSWORD=testpass -e WPUSERNAMERANGESTART=1 -e WPUSERNAMERANGEEND=500 -e VUSERSHOME=800 -e VUSERSBROWSER=400 -e VUSERSBUYER=400 -e VUSERSCUSTOMER=200
```