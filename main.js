const crypto = require('crypto');

const replacementContent = 'Will be replaced with HMAC of request body turned into Query String';
const settings = {
  key: null,
  algorithm: null,
  encoding: null,
  parseJson: false,
  nonce: null
};

function convertToQueryString(content) {
  if(content === '') {
    return content;
  }
  try {
    let json = JSON.parse(content);
    let keys = Object.keys(json);
    let arrayFields = [];
    for (const key of keys) {
      if(typeof json[key] !== 'object') {
        arrayFields.push(key + "=" + json[key]);
      }
    }
    return arrayFields.join('&');
  } catch (e) {
    return content;
  }
}
function hmac(content) {
  // console.log("hmac("+content+")")
  if(settings.parseJson) {
    // console.log("parseJson is true");
    content = convertToQueryString(content);
  }
  const hash = crypto.createHmac(settings.algorithm, settings.key);
  hash.update(content, 'utf8');
  return hash.digest(settings.encoding);
}

function replaceWithHMAC(content, body) {
  // console.log("replaceWithHMAC("+content+", "+body+")");
  // return content.replace(new RegExp(replacementContent, 'g'), hmac(nonce + ':' +body))
  return hmac(settings.nonce+':'+body);
}

module.exports.templateTags = [{
  name: 'nonceBodyHmac',
  displayName: 'HMAC with nonce',
  description: 'HMAC nonce and body',
  args: [
    {
      displayName: 'Algorithm',
      type: 'enum',
      options: [
        { displayName: 'MD5', value: 'md5' },
        { displayName: 'SHA1', value: 'sha1' },
        { displayName: 'SHA256', value: 'sha256' },
        { displayName: 'SHA512', value: 'sha512' }
      ]
    },
    {
      displayName: 'Digest Encoding',
      description: 'The encoding of the output',
      type: 'enum',
      options: [
        { displayName: 'Hexadecimal', value: 'hex' },
        { displayName: 'Base64', value: 'base64' }
      ]
    },
    {
      displayName: 'Key',
      type: 'string',
      placeholder: 'HMAC Secret Key'
    },
    {
      displayName: 'nonce',
      type: 'string',
      placeholder: '0'
    },
    {
      displayName: 'Message',
      type: 'string',
      placeholder: 'Message to hash (leave empty to use request body)'
    }
  ],
  run(context, algorithm, encoding, key = '', nonce = '', value = '') {
    if (encoding !== 'hex' && encoding !== 'base64') {
      // console.log("enco");
      throw new Error(`Invalid encoding ${encoding}. Choices are hex, base64`);
    }

    const valueType = typeof value;
    if (valueType !== 'string') {
      // console.log("notstring "+valueType);
      throw new Error(`Cannot hash value of type "${valueType}"`);
    }

    settings.key = key;
    settings.algorithm = algorithm;
    settings.encoding = encoding;
    settings.parseJson = false;//parseJson;
    settings.nonce = nonce;
    // console.log("preblah");
    if (value === '') {
      // console.log("empty value:"+replacementContent);
      return replacementContent;
    } else {
      // console.log("non-empty value:");
      // console.log(nonce + ':' +value);
      return hmac(nonce + ':' +value);
    }
    // console.log("done");
  }
}];

module.exports.requestHooks = [
  context => {
    // console.log("hook");
    const bodyString = context.request.getBody().text;
    // console.log("bd:"+bodyString)
    if (bodyString===undefined) { return; }
    // console.log("hook0");
    if (context.request.getUrl().indexOf(replacementContent) !== -1) {
      // console.log("hook1");
      context.request.setUrl(replaceWithHMAC(context.request.getUrl(), bodyString));
    }
    // console.log("hook2a");
    if (bodyString.indexOf(replacementContent) !== -1) {
      // console.log("hook2b");
      context.request.setBody({
        mimeType: 'application/json',
        text: replaceWithHMAC(bodyString, bodyString),
      });
    }
    // console.log("hook3a");
    context.request.getHeaders().forEach(h => {
      // console.log("hook3b");
      if (h.value.indexOf(replacementContent) !== -1) {
        // console.log("hook3c");
        context.request.setHeader(h.name, replaceWithHMAC(h.value, bodyString));
      }
    });
    // console.log("hook4a");
    context.request.getParameters().forEach(p => {
      // console.log("hook4b");
      if (p.value.indexOf(replacementContent) !== -1) {
        // console.log("hook4c");
        context.request.setParameter(p.name, replaceWithHMAC(p.value, bodyString));
      }
    });
  }
];
