const fs = require('fs');
const SSB = require('./main');

/* eslint-disable no-console */

if (!fs.existsSync('./config.json')) {
  console.log('No config found');
  fs.writeFileSync('./config.json', `{
  "username": "xxxxxxx@example.com",
  "password": "xxxxxxx",
  "domains": ["*.example.com"],
  "paths": {
    "crt": "./certificate.crt",
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
  || !config.domains
  || !config.paths
) {
  console.error('Wrong "./config.json" file');
  process.exit(1);
}

const check = async () => {
  console.log('Login...');
  const certs = (await SSB.login(config.username, config.password))
    .filter((c) => config.domains.includes(c.domain));

  console.log('Checking', certs.length, 'certificate(s)');

  certs.forEach(async (cert) => {
    if (cert.daysLeft === 0) {
      console.log('Deleting:', cert);
      console.log('Deleted !', await cert.delete());
    }

    if (cert.daysLeft < 10) {
      console.log('Renew certificate:', cert);

      cert.renew(({
        organizationName: 'Iridium',
        organizationalUnit: 'Iridium',
        country: 'FR',
      }), (keys) => {
        console.log('Certificate for', cert.domain, 'renewed !');

        if (config.paths.crt) fs.writeFileSync(config.paths.crt, keys.publicKey);
        if (config.paths.key) fs.writeFileSync(config.paths.key, keys.privateKey);
      }, (status) => {
        // 'Created' > 'Started verification' > 'Generating' > 'Complete'
        console.log('Progress:', status);
      });
    }
  });
};

check();
setInterval(check, 24 * 60 * 60 * 1000);
