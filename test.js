const fs = require('fs');
const SSB = require('./main');

/* eslint-disable no-console */

if (!fs.existsSync('./config.json')) {
  console.log('No config found');
  fs.writeFileSync('./config.json', `{
  "username": "xxxxxxx@example.com",
  "password": "xxxxxxx",
  "domain": "*.example.com",
  "paths": {
    "crt": "./certificate.crt",
    "pem": "./certificate.pem",
    "key": "./certificate.key"
  }
}`);
  console.log('Please complete "./config.json" file.');
  process.exit(0);
}

let config = {};

try {
  config = JSON.parse(fs.readFileSync('./config.json'));
} catch (error) {
  console.error('Can\'t parse "./config.json" file');
}

if (!config
  || !config.username
  || !config.password
  || !config.domain
  || !config.paths
) {
  console.error('Wrong "./config.json" file');
  process.exit(1);
}

(async () => {
  console.log('Login...');
  await SSB.login(config.username, config.password);
  // const firstExpired = certs.filter((c) => c.status === 'Expired')[0];
  // console.log('Deleting:', firstExpired);
  // console.log('Done !', await firstExpired.delete());
  console.log('Creating cert...');
  console.log('Done !', await SSB.createCert({
    domain: 'example.com',
    type: 'HTTP',
  }));

  setInterval(async () => {
    console.log('Getting waiting certs...');
    const firstWaiting = (await SSB.getCerts()).filter((c) => c.status === 'Created' || c.status === 'Initialized')[0];
    if (!firstWaiting) return console.log('No waiting');
    console.log('Deleting:', firstWaiting);
    console.log('Done !', await firstWaiting.delete());
    return true;
  }, 5000);
})();
