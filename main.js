const https = require('https');
const fs = require('fs');

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

function getCerts(session = '') {
  console.log('Getting tokens...');
  const req = https.request({
    method: 'GET',
    hostname: 'www.shieldsigned.com',
    path: '/certificates',
    headers: {
      Cookie: `_shield_signed_session=${session}`,
    },
  }, (res) => {
    let data = '';
    res.on('data', (d) => { data += d; });
    res.on('close', () => {
      const certs = data.split('<tbody>')[1].replace(/(\t| {2,})/g, '').match(/<tr>(\n|\r|.)+?<\/tr>/g).map((c) => {
        const lines = c.split('\n').map((l) => l.replace(/<.*?>|<\/.*?>/g, ''));
        return {
          status: lines[1],
          domain: lines[3],
          creation: new Date(lines[4]),
        };
      });
      console.log('Certs:', certs);
    });
  });

  req.on('error', () => {
    console.log('Can\'t reach shieldsigned.com server');
    process.exit(1);
  });

  req.end();
}

function login(token = '', session = '') {
  console.log('Login...');
  const req = https.request({
    method: 'POST',
    hostname: 'www.shieldsigned.com',
    path: '/users/sign_in',
    headers: {
      'Content-Type': 'multipart/form-data',
      Cookie: `_shield_signed_session=${session}`,
    },
  }, (res) => {
    res.on('data', () => null);
    res.on('close', () => {
      if (res.statusCode !== 302) {
        console.error('Wrong username or password');
        process.exit(1);
      }

      const newSession = res.headers['set-cookie'][0].split(';')[0].split('=', 2).pop();
      if (!newSession) {
        console.error('Can\'t auth token, please make sure you have the latest version of this program');
        console.error('Go to "https://github.com/Mathieu2301/Shieldsigned-Bot/issues" if you get any issue');
        process.exit(1);
      }

      console.log('OK.');
      getCerts(newSession);
    });
  });

  req.on('error', () => {
    console.log('Can\'t reach shieldsigned.com server');
    process.exit(1);
  });

  req.end(`authenticity_token=${token.replace(/\+/g, '%2B').replace(/\//g, '%2F')
  }==&user%5Bemail%5D=${config.username.replace(/@/g, '%40')
  }&user%5Bpassword%5D=${config.password
  }&user%5Bremember_me%5D=0&commit=Log+in`);
}

const req = https.get('https://www.shieldsigned.com/users/sign_in', (res) => {
  let data = '';
  res.on('data', (d) => { data += d; });
  res.on('close', () => {
    const token = data.match(/"csrf-token" content=".*"/gm)[0].replace(/"/g, '').split('=', 2).pop();
    const session = res.headers['set-cookie'][0].split(';')[0].split('=', 2).pop();
    if (!token || !session) {
      console.error('Can\'t get auth token, please make sure you have the latest version of this program');
      console.error('Go to "https://github.com/Mathieu2301/Shieldsigned-Bot/issues" if you get any issue');
      process.exit(1);
    }
    login(token, session);
  });
});

req.on('error', () => {
  console.log('Can\'t reach shieldsigned.com server');
  process.exit(1);
});

req.end();
