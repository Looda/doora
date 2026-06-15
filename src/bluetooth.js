const SVC_UUID = '5f6d4f53-5f52-5043-5f53-56435f49445f';
const DATA_UUID = '5f6d4f53-5f52-5043-5f64-6174615f5f5f';
const USER = 'admin';

const commands = {
  'toggle': { id: 1, method: "Switch.Toggle", params: { id: 0 } },
  'turn-on-05s': { id: 1, method: "Switch.Set", params: { id: 0, on: true, toggle_after: 0.5 } }
}

const addAuthToCommand = (auth, command) => {
  return {
    ...command,
    id: 2,
    auth,
  }
}

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

async function calculateResponse(user, pass, realm, nonce, method, uri) {
  const cnonce = Math.floor(Math.random() * 1000000);
  const nc = 1;
  const ha1 = await sha256(`${user}:${realm}:${pass}`);
  const ha2 = await sha256(`${method || 'dummy_method'}:${uri || 'dummy_uri'}`);
  const response = await sha256(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`);
  return {
    realm,
    username: user,
    nonce,
    cnonce,
    nc: nc,
    algorithm: "SHA-256",
    response
  };
}

async function sendJson(dataChar, jsonObj) {
  return new Promise((resolve, reject) => {
    const callback = (event) => {
      const reply = JSON.parse(new TextDecoder().decode(event.target.value));
      dataChar.removeEventListener('characteristicvaluechanged', callback);
      resolve(reply);
    };

    dataChar.addEventListener('characteristicvaluechanged', callback);

    const data = new TextEncoder().encode(JSON.stringify(jsonObj) + '\0');
    dataChar.writeValue(data).catch(reject);
  });
}

const sendAuthJson = async (dataChar, jsonObj, user, pwd, realm, nonce, method, suffix) => {
  const authData = await calculateResponse(
    user,
    pwd,
    realm,
    nonce,
    method,
    suffix,
  );

  const authorizedCommand = addAuthToCommand(authData, jsonObj);

  const secondReply = await sendJson(dataChar, authorizedCommand);
  if (secondReply.error) {
    console.log("Authorization failed:", secondReply.error);
    return false;
  } else {
    return true;
  }
}

async function getKnownDevices() {
  let devices = [];
  if (navigator.bluetooth.getDevices) {
    try {
      devices = await navigator.bluetooth.getDevices();
    } catch {
      console.log('Error: getDevices');
    }
  }
  return devices;
}

async function connectBTServer(device) {
  if (device) {
    try {
      if (device && device.gatt.connected) {
        return device.gatt;
      } else {
        const server = await device.gatt.connect();
        return server;
      }
    } catch {
      return null;
    }
  }
  return null;
}

async function openViaBT(server, command, password) {
  const service = await server.getPrimaryService(SVC_UUID);
  const dataChar = await service.getCharacteristic(DATA_UUID);

  await dataChar.startNotifications();
  const commandJson = commands[command];

  const firstReply = await sendJson(dataChar, commandJson);

  if (firstReply.error && firstReply.error.code === 401) {

    const firstReplyData = JSON.parse(firstReply.error.message);
    if (!password) {
      setPasswordInvalid(true);
      setReady();
      return;
    }
    await delay(500);
    const result = await sendAuthJson(dataChar, commandJson, USER, password, firstReplyData.realm, firstReplyData.nonce, '', '');
    setPasswordInvalid(!result);
  } else {
    console.log("Done without authorization.");
  }
}