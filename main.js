const https = require('https');

const activeSession = {
  token: null,
  session: null,
};

function request(infos = {}, payload = '') {
  return new Promise((cb, err) => {
    const req = https.request(infos, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('close', () => {
        const token = data.match(/"csrf-token" content=".*"/gm);
        const session = res.headers['set-cookie'];

        if (token) activeSession.token = token[0].replace(/"/g, '').split('=', 2).pop();
        if (session && session.filter) {
          activeSession.session = session
            .filter((c) => c.includes('session'))[0]
            .split(';')[0].split('=', 2).pop();
        }

        cb({ data, status: res.statusCode });
      });
    });

    req.on('error', () => {
      err(new Error('Can\'t reach shieldsigned.com server'));
    });

    req.end(payload);
  });
}

module.exports = {
  async login(username = '', password = '') {
    // Init session
    const sessRQ = await request({
      method: 'GET',
      hostname: 'www.shieldsigned.com',
      path: '/users/sign_in',
    });

    if (sessRQ.status !== 200) {
      throw new Error(`Can't get auth token, please make sure you have the latest version of this program.
      Go to "https://github.com/Mathieu2301/Shieldsigned-Bot/issues" if you get any issue.`);
    }

    // Login
    const loginRQ = await request({
      method: 'POST',
      hostname: 'www.shieldsigned.com',
      path: '/users/sign_in',
      headers: {
        'content-type': 'multipart/form-data',
        cookie: `_shield_signed_session=${activeSession.session}`,
      },
    }, `authenticity_token=${activeSession.token.replace(/\+/g, '%2B').replace(/\//g, '%2F')
    }==&user%5Bemail%5D=${username.replace(/@/g, '%40')
    }&user%5Bpassword%5D=${password}&user%5Bremember_me%5D=0&commit=Log+in`);

    if (loginRQ.status !== 302) throw new Error('Wrong username or password');

    return this.getCerts();
  },

  async getCerts() {
    if (!activeSession.session || !activeSession.token) throw new Error('Not logged');

    const certsRQ = await request({
      method: 'GET',
      hostname: 'www.shieldsigned.com',
      path: '/certificates',
      headers: {
        cookie: `_shield_signed_session=${activeSession.session}`,
      },
    });

    const table = certsRQ.data.split('<tbody>')[1];
    if (!table) return [];

    return certsRQ.data.split('<tbody>')[1].replace(/(\t| {2,})/g, '').match(/<tr>(\n|\r|.)+?<\/tr>/g).map((c) => {
      const lines = c.split('\n').map((l) => l.replace(/<.*?>|<\/.*?>/g, ''));

      const id = c.match(/<a href="\/certificates\/[0-9]*?">View</g)[0].split('/').pop().split('"')[0];
      const creation = new Date(lines[4]);
      const expiration = new Date((new Date(lines[4])).setMonth(creation.getMonth() + 3));
      const daysLeft = Math.floor((expiration.getTime() - Date.now()) / 86400000);

      const { deleteCert } = this;

      return {
        id,
        status: (daysLeft > 0 ? lines[1] : 'Expired'),
        domain: lines[3],
        creation,
        expiration,
        daysLeft: daysLeft > 0 ? daysLeft : 0,
        async delete() {
          return deleteCert(id);
        },
      };
    });
  },

  async deleteCert(certId = '') {
    if (!activeSession.session || !activeSession.token) throw new Error('Not logged');

    const delRQ = await request({
      method: 'POST',
      hostname: 'www.shieldsigned.com',
      path: `/certificates/${certId}`,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `_shield_signed_session=${activeSession.session}`,
      },
    }, `_method=delete&authenticity_token=${activeSession.token.replace(/\+/g, '%2B').replace(/\//g, '%2F')}==`);

    if (delRQ.status === 302) return true;
    if (delRQ.status === 404) throw new Error('Certificate not found');
    throw new Error(`Unknown error: ${delRQ.status}`);
  },

  async createCert(options = {
    domain: '',
    CSR: '',
    organizationName: '',
    organizationalUnit: '',
    country: '',
    type: 'HTTP',
  }) {
    if (!activeSession.session || !activeSession.token) throw new Error('Not logged');
    if (!options.domain && !options.CSR) throw new Error('Please specify a domain or a CSR');
    if (!['HTTP', 'DNS'].includes(options.type)) throw new Error('Verification type can only be HTTP or DNS');

    const createRQ = await request({
      method: 'POST',
      hostname: 'www.shieldsigned.com',
      path: '/certificates/',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `_shield_signed_session=${activeSession.session}`,
      },
    }, `authenticity_token=${activeSession.token.replace(/\+/g, '%2B').replace(/\//g, '%2F')
    }==&certificate%5Bidentifiers%5D=${options.domain || ''
    }&certificate%5Bcsr%5D=${options.CSR || ''
    }&certificate%5Borganization_name%5D=${options.organizationName || ''
    }&certificate%5Borganizational_unit%5D=${options.organizationalUnit || ''
    }&certificate%5Bcountry_name%5D=${options.country || ''
    }&certificate%5Bverification_type%5D=${options.type || ''}`);

    if (createRQ.status === 302) return true;
    throw new Error(`Unknown error: ${createRQ.status}`);
  },
};
