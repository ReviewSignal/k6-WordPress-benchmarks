// Environmental Variable Setup
export function setupEnvironment(requiredVars = [], defaultValues = {}) {
    const envVars = {};

    if (requiredVars.includes('siteUrl')) {
        let siteUrl = __ENV.TARGET || defaultValues.siteUrl;
        if (siteUrl === undefined) {
            throw new Error("Missing TARGET variable");
        }
        // make sure we have trailing slash on the url
        const lastChar = siteUrl.substr(-1);
        if (lastChar != '/') {
            siteUrl = siteUrl + '/';
        }
        envVars.siteUrl = siteUrl;
    }

    if (requiredVars.includes('password')) {
        let password = __ENV.WPPASSWORD || defaultValues.password;
        if (password === undefined) {
            throw new Error("Missing WPPASSWORD variable");
        }
        envVars.password = password;
    }

    if (requiredVars.includes('usernameBase')) {
        let usernameBase = __ENV.WPUSERNAME || defaultValues.usernameBase;
        if (usernameBase === undefined) {
            throw new Error("Missing WPUSERNAME variable");
        }
        envVars.usernameBase = usernameBase;
    }

    if (requiredVars.includes('usernameRange')) {
        let usernameRangeStart = __ENV.WPUSERNAMERANGESTART || defaultValues.usernameRangeStart;
        if (usernameRangeStart === undefined) {
            throw new Error("Missing WPUSERNAMERANGESTART variable");
        }

        let usernameRangeEnd = __ENV.WPUSERNAMERANGEEND || defaultValues.usernameRangeEnd;
        if (usernameRangeEnd === undefined) {
            throw new Error("Missing WPUSERNAMERANGEEND variable");
        }

        envVars.usernameRange = {
            start: parseInt(usernameRangeStart),
            end: parseInt(usernameRangeEnd),
        };
    }

    if (requiredVars.includes('customHeader')) {
        let customHeaderName = __ENV.CUSTOMHEADERNAME || defaultValues.customHeaderName || 'X-CustomHeader'; // default
        envVars.customHeaderName = customHeaderName;

        let customHeaderValue = __ENV.CUSTOMHEADERVALUE || defaultValues.customHeaderValue || '1'; // default
        envVars.customHeaderValue = customHeaderValue;
    }

    if (requiredVars.includes('wpLogin')) {
        let wpLogin = __ENV.WPLOGIN || defaultValues.wpLogin || 'wp-login.php'; // default
        envVars.wpLogin = wpLogin;
    }

    if (requiredVars.includes('domainFilter')) {
        let domainFilter = __ENV.DOMAINFILTER || defaultValues.domainFilter || 'gravatar.com,googleapis.com,stats.wp.com'; // default
        envVars.domainFilter = domainFilter.split(',');
    }

    if (requiredVars.includes('pause')) {
        const pause = {
            min: parseFloat(__ENV.MINPAUSE) || defaultValues.minPause || 5, // default to 5
            max: parseFloat(__ENV.MAXPAUSE) || defaultValues.maxPause || 10, // default to 10
        };
        envVars.pause = pause;
    }

    // Handle VUsers
    if (requiredVars.includes('vusers')) {
        let vusers = parseInt(__ENV.VUSERS) || defaultValues.vusers || 1; // default to 1
        envVars.vusers = vusers;
    }

    // Handle Duration
    if (requiredVars.includes('duration')) {
        let duration = __ENV.DURATION || defaultValues.duration || '15m'; // default to 15 minutes
        envVars.duration = duration;
    }

    // Handle VUsersHome
    if (requiredVars.includes('vusersHome')) {
        let vusersHome = parseInt(__ENV.VUSERSHOME) || defaultValues.vusersHome || 1; // default to 1
        envVars.vusersHome = vusersHome;
    }

    // Handle VUsersBrowser
    if (requiredVars.includes('vusersBrowser')) {
        let vusersBrowser = parseInt(__ENV.VUSERSBROWSER) || defaultValues.vusersBrowser || 1; // default to 1
        envVars.vusersBrowser = vusersBrowser;
    }

    // Handle VUsersBuyer
    if (requiredVars.includes('vusersBuyer')) {
        let vusersBuyer = parseInt(__ENV.VUSERSBUYER) || defaultValues.vusersBuyer || 1; // default to 1
        envVars.vusersBuyer = vusersBuyer;
    }

    // Handle VUsersCustomer
    if (requiredVars.includes('vusersCustomer')) {
        let vusersCustomer = parseInt(__ENV.VUSERSCUSTOMER) || defaultValues.vusersCustomer || 1; // default to 1
        envVars.vusersCustomer = vusersCustomer;
    }

    return envVars;
}