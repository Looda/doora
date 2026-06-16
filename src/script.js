const NEW_DEVICE_OPTION = 'new';
const MANUAL_DEVICE_OPTION = 'manual';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getPasswordStoreKey(device) {
  return `${device}_pwd`;
}

function keepPwd(deviceId) {
  return document.getElementById('keep-pwd').checked && deviceId !== NEW_DEVICE_OPTION;
}

function onKeepPwd() {
  const deviceId = document.getElementById('device').value;
  const storeKey = getPasswordStoreKey(deviceId);
  if (keepPwd(deviceId)) {
    localStorage.setItem(storeKey, document.getElementById('pwd').value);
  } else {
    localStorage.removeItem(storeKey);
  }
}

function onConfig(element) {
  const value = element.type === 'checkbox' ? element.checked : element.value;
  localStorage.setItem(element.id, value);
}

function readConfig(elementId) {
  const element = document.getElementById(elementId);
  if (element.type === 'checkbox') {
    element.checked = localStorage.getItem(elementId) === 'true';
  } else {
    element.value = localStorage.getItem(elementId);
  }
}

function syncPwd() {
  const input = document.getElementById('pwd');
  const deviceId = document.getElementById('device').value;
  input.classList.remove('invalid');
  if (keepPwd(deviceId))
    localStorage.setItem(getPasswordStoreKey(deviceId), input.value);
}

function togglePwd() {
  const input = document.getElementById('pwd');
  const btn = document.getElementById('pwd-toggle');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
}

function toggleDevice() {
  const device = document.getElementById('device');
  const deviceEdit = document.getElementById('device-edit');
  const btn = document.getElementById('device-toggle');
  const showEdit = device.style.display === 'none';
  device.style.display = showEdit ? 'block' : 'none';
  deviceEdit.style.display = showEdit ? 'none' : 'block';
  btn.textContent = showEdit ? '⌨️' : '🔍';
  const deviceOptions = device.options ?? [];
  deviceEdit.value = [...deviceOptions].find(({value}) => value === MANUAL_DEVICE_OPTION).text ?? '';
}

function setLoading() {
  const btn = document.getElementById('open-btn');
  btn.textContent = '🕑';
}

function setReady() {
  const btn = document.getElementById('open-btn');
  btn.classList.remove('error');
  btn.textContent = '▶️';
}

function setError() {
  const btn = document.getElementById('open-btn');
  btn.classList.add('error');
  btn.textContent = '▶️';
}

function setPasswordInvalid(invalid) {
  if (invalid) {
    document.getElementById('pwd').classList.add('invalid');
  } else {
    document.getElementById('pwd').classList.remove('invalid');
  }
}

async function connectAndTurnOn() {
  setLoading();
  try {
    const command = document.getElementById('auto-off').checked ? 'turn-on-05s' : 'toggle';
    const password = document.getElementById("pwd").value;
    const allowApi = document.getElementById('allow-api').checked;
    const deviceEdit = document.getElementById('device-edit');
    const showEdit = deviceEdit.style.display !== 'none';
    if (showEdit) {
      createDeviceOption(MANUAL_DEVICE_OPTION, deviceEdit.value);
      const deviceElement = document.getElementById('device');
      deviceElement.value = MANUAL_DEVICE_OPTION;
      const devices = [...deviceElement.options].filter((option) => option.value !== 'new').map((option) => ({ id: option.value, name: option.text }))
      localStorage.setItem('devices', JSON.stringify(devices));
      localStorage.setItem('lastDeviceId', MANUAL_DEVICE_OPTION);
      setPasswordByDeviceId(MANUAL_DEVICE_OPTION);
    }
    let devices = await getKnownDevices();
    const selectedDevice = document.getElementById('device').value;
    let btDevice = devices.find(d => d.id === selectedDevice);
    let server = await connectBTServer(btDevice);
    if (selectedDevice !== NEW_DEVICE_OPTION && !server && allowApi) {
      openViaMqtt(selectedDevice, password, command);
      return;
    }
    if (!server) {
      btDevice = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'Shelly' }],
        optionalServices: [SVC_UUID]
      });
      if (btDevice) {
        createDeviceOption(btDevice.id, btDevice.name);
        const deviceElement = document.getElementById('device');
        deviceElement.value = btDevice.id;
        const devices = [...deviceElement.options].filter((option) => option.value !== 'new').map((option) => ({ id: option.value, name: option.text }))
        localStorage.setItem('devices', JSON.stringify(devices));
        localStorage.setItem('lastDeviceId', btDevice.id);
        setPasswordByDeviceId(btDevice.id);
      }
      server = await btDevice.gatt.connect();
    }
    if (!btDevice || !server) {
      return;
    }
    openViaBT(server, command, password);
    await delay(500);
  } catch (error) {
    console.error("Error:", error);
    setError();
    await delay(500);
  } finally {
    setReady();
  };
}

async function deviceChanged() {
  const deviceId = document.getElementById('device').value;
  localStorage.setItem('lastDeviceId', deviceId);
  setPasswordByDeviceId(deviceId);
}

function setPasswordByDeviceId(deviceId) {
  const savedPwd = localStorage.getItem(getPasswordStoreKey(deviceId));
  document.getElementById('pwd').value = savedPwd || '';
  document.getElementById('keep-pwd').checked = savedPwd !== null;
}

function createDeviceOption(id, name) {
  const deviceElement = document.getElementById('device');
  let i = 0;
  while (i < deviceElement.options.length) {
    if (deviceElement.options.item(i).value === id) {
      return;
    }
    i++;
  }
  const item = document.createElement("option");
  item.value = id;
  item.textContent = name;
  deviceElement.add(item);
}

async function initApp() {
  readConfig('auto-off');
  readConfig('allow-api');
  readConfig('api-server');

  const devices = JSON.parse(localStorage.getItem('devices')) || [];
  const deviceElement = document.getElementById('device');
  if (deviceElement.options.length === 1 && devices.length > 0) {
    devices.forEach((device) => {
      createDeviceOption(device.id, device.name);
    });
  }
  const savedId = localStorage.getItem('lastDeviceId');
  if (savedId) {
    deviceElement.value = savedId;
    setPasswordByDeviceId(savedId);
  }
}

function copyLink() {
  navigator.clipboard.writeText('chrome://flags/#web-bluetooth-new-permissions-backend');
}

function openText(name) {
  if (name === 'config') {
    document.getElementById('config-text').classList.toggle('open')
    document.getElementById('help-text').classList.remove('open')
  } else {
    document.getElementById('config-text').classList.remove('open')
    document.getElementById('help-text').classList.toggle('open')
  }
}

async function openViaMqtt(deviceId, password, command) {
  const server = document.getElementById('api-server').value;
  const deviceElement = document.getElementById('device');
  const device = [...deviceElement.options].find((option) => option.value === deviceId);
  if (!server || !device || !password) {
    return;
  }
  setLoading();
  try {
    const response = await fetch(`${server}/command/${command}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${device.text}:${password}`),
      }
    });

    if (response.ok) {
      const data = await response.json();
      setReady();
    } else {
      const err = await response.json();
      setError();
      await delay(500);
      setReady();
    }
  } catch (e) {
    console.error("Network error:", e);
    setError();
    await delay(500);
    setReady();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});