const notifier = require('node-notifier');
const child_process = require('child_process');
const https = require('https');
const { exit } = require('process');


process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0; // some of the certs are self signed in the chain, this is risky
let localInterfaceToUse = null;
let intervalSec = 15;
let VACCINE_THRESHOLD = 2;


//>node index.js
//IFFY
//single shot to start things off
(async () => {
    try {
        //cowin does not work on VPN, this one will iterate and select the first Wifi assuming it is non vpn
        //change this routine to get appropriate interface
        localInterfaceToUse = getVPNFreeWIFIFromLocal();

        if (!localInterfaceToUse) {
            console.log('unable to get non vpn, exiting');
            exit();
        }
        console.log('using local interface:' + localInterfaceToUse);

        await findSlot();
    } catch (e) {
        console.log(e);
    }
})();



setInterval(findSlot, intervalSec * 1000);
console.log('will check with a timer of ' + intervalSec + ' seconds')

async function findSlot() {
    try {
        console.log('getting vaccine data');
        var vaccineData = await getVaccineDataNotVPN();
        //var vaccineData = readFromFile();
        console.log('got vaccine data');
        sendAlert(vaccineData);
        // console.log(vaccineData);
    } catch (e) {
        console.log(e);
    }
}

/*async*/

function sendAlert(apiJSON) {

    // apiJSON = JSON.parse(apiJSON);
    let found = false;
    console.log('processing start');
    for (let center of apiJSON.centers) {
        found = found || getSlots(center);
        //console.log(row);
    }
    console.log('.');
    console.log('processing finished');
    if (!found) {
        console.log('no slots found');
    }
    console.log('');

}

//will show winows alert if slots are found
function getSlots(centerJson) {

    let availableTotal = 0;
    let found = false;
    //console.log('********************************');
    // console.log('going for:' + centerJson.name);
    //sessions
    for (let session of centerJson.sessions) {
        let doses = session.available_capacity_dose1;
        // console.log('' + doses + session.min_age_limit + session.vaccine);
        if ( doses >= VACCINE_THRESHOLD && session.min_age_limit < 45 && session.vaccine === 'COVAXIN') {
            //send notify
            console.log('+++++++++++covaxin slots found at++++++++++++++++++');
            console.log(centerJson.name);
            console.log('+++++++++++++++++++++++++++++++++++++++++++++++++++');
            console.log('doses:' + doses);

            showNotification(doses + ' slots found' + '@' + centerJson.name);

            child_process.execSync('rundll32 user32.dll,MessageBeep');
            found = true;
            break;
        }
        else {
            // console.log('dose:' + doses + 'for:' + session.vaccine);
        }
        process.stdout.write(".");

    }
    //console.log('********************************');
    //console.log('\n\n\n\n\n')

    return found;
}

//TODO - replace district here with mumbai now
async function getVaccineDataNotVPN() {
    const options = {
        hostname: 'cdn-api.co-vin.in',
        port: 443,
        path: '/api/v2/appointment/sessions/public/calendarByDistrict?district_id=650&date=' + makeTodayDate(),
        method: 'GET',
        localAddress: localInterfaceToUse,
        headers: {
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36',
            'origin': 'https://selfregistration.cowin.gov.in',
            'referer': 'https://selfregistration.cowin.gov.in/'

        }
    }
    return await httpRequest(options);

}

function httpRequest(params) {
    return new Promise(function (resolve, reject) {
        var req = https.request(params, function (res) {
            // reject on bad status
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error('statusCode=' + res.statusCode));
            }
            // cumulate data
            var body = [];
            res.on('data', function (chunk) {
                body.push(chunk);
            });
            // resolve on end
            res.on('end', function () {
                try {
                    body = JSON.parse(Buffer.concat(body).toString());
                } catch (e) {
                    reject(e);
                }
                resolve(body);
            });
        });
        // reject on request error
        req.on('error', function (err) {
            // This is not a "Second reject", just a different sort of failure
            reject(err);
        });

        // IMPORTANT
        req.end();
    });
}


//for local testing
function readFromFile() {
    const fs = require('fs');

    const data = fs.readFileSync('./vaccines.txt',
        { encoding: 'utf8', flag: 'r' });

    return data;

}


function showNotification(str) {
    notifier.notify({
        'title': 'Vaccine available',
        'message': str,
        'icon': 'dwb-logo.png',
        'contentImage': 'blog.png',
        'sound': 'ding.mp3',
        'wait': true
    });
}

function makeTodayDate() {
    let d = new Date();
    let ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(d);
    let mo = new Intl.DateTimeFormat('en', { month: '2-digit' }).format(d);
    let da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(d);
    return ('' + da + '-' + mo + '-' + ye);

}

function getVPNFreeWIFIFromLocal() {
    let eths = require('os').networkInterfaces();
    let wifi = eths['Wi-Fi'];
    for (let ip of wifi) {
        if (ip.family === 'IPv4') {
            return ip.address;
        }
    }
}
