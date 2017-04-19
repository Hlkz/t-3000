
var socket = io('', {
  path: document.getElementById('ioPath').getAttribute('value'),
  query: 'r_var='+window.location.pathname
})

// conf
let ALLOW_CMD_DELAY = 150 // ms
// Default values, equal to server default values
let Conf = null
let ConfGM = null
let isGM = false
// misc
let stateTimeout = null
let ALLOW_CMD = true
let hide = 'hide'

let GetDiv = id => document.getElementById(id)
let ShowDiv = (id, html=null, display='block') => {
  let el = GetDiv(id)
  el.style.display = display
  if (html) el.innerHTML = html
}
let ShowDivI = (id, html=null) => { ShowDiv(id, html, 'inline') }
let SetDiv = (bool, id, html=null, display='block') => {
  if (bool)
    ShowDiv(id, html, display)
  else if (IsShown(id, display))
    HideDiv(id)
}
let SetDivI = (bool, id, html=null) => { SetDiv(bool, id, html, 'inline') }
let HideDiv = id => { GetDiv(id).style.display = 'none' }
let IsShown = (id, display='block') => GetDiv(id).style.display === display
let renderMain = h => { ShowDiv('main', h) }
let renderSecond = h => { ShowDiv('second', h) }
let hideSecond = () => { HideDiv('second') }
let isSecondShown = () => IsShown('second')
let renderThird = h => { ShowDiv('third', h) }
let hideThird = () => { HideDiv('third') }
let isThirdShown = () => IsShown('third')
let renderTimeout = h => { ShowDiv('timeout', h) }
let hideTimeout = () => { HideDiv('timeout') }
let renderCount = h => { ShowDiv('count', h) }
let hideCount = () => { HideDiv('count') }

function Beep(id) {
  let audio = document.getElementById(id)
  audio.load()
  audio.play()
}
function Bell() { Beep('audioFile') }
function Bol() { Beep('audioFile2') }

let keyEventListener =  event => {
  if (!Conf) return
  var key = event.keyCode
  if (key == 9 || key == 27)
    event.preventDefault()
  if (document.hasFocus() && document.activeElement.tagName == 'INPUT') {
    if (key == 27)
      document.activeElement.trigger('blur')
    return
  }
  // View change
  if (key == 9) { // Tab
    TogglePanel()
    return
  }
  // Send info to server
  if (!ALLOW_CMD) return
  if (key == 186) // $
    SendGetGM()
  else if (!ConfGM)
    return
  else if (key == 13 || key == 32) // Enter Space
    SendState()
  else if (key > 47 && key < Math.min(58, 49+Conf.maxNumber)) // 123456789
    SendState(key-48)
  else if (key > 64 && key < Math.min(91, 65+Conf.maxNumber)) // alphabet
    SendState(key-64)
  else if (key > 96 && key < 101) // NumPad 1234
    SendMode(key-96)
  else if (key == 107)
    SendWait()
  else return
  ALLOW_CMD = false
  setTimeout(()=>{ ALLOW_CMD = true }, ALLOW_CMD_DELAY)
}
let clickListener = event => {
  if (!Conf || !ConfGM) return
  if (!ALLOW_CMD) return
  SendState()
  ALLOW_CMD = false
  setTimeout(()=>{ ALLOW_CMD = true }, ALLOW_CMD_DELAY)
}
document.addEventListener('keydown', keyEventListener, true)
document.getElementById('topright').addEventListener('click', clickListener, false)

function TogglePanel() {
  if (IsShown('panel'))
    HideDiv('panel')
  else if (ConfGM)
    ShowDiv('panel')
}

let ToggleEnableOverwrite = () => SendEnableOverwrite(!ConfGM.enableOverwrite)
let ToggleSendFake = () => SendSendFake(!ConfGM.sendFake)
let ToggleDoubleBlind = () => SendDoubleBlind(!ConfGM.doubleBlind)
let ToggleRandomize = () => SendRandomize(!ConfGM.randomize)
let ToggleEnableOverwriteGM = () => SendEnableOverwriteGM(!ConfGM.enableOverwriteGM)

function Wait(time) {
  renderTimeout('<div class="txt">'+Math.floor(time/1000)+'</div>')
  if (time > 999) {
    clearTimeout(stateTimeout)
    stateTimeout = setTimeout(()=>{ Wait(time-1000) }, 1000)
  }
  else
    hideTimeout()
}

function ClearTimeout() {
  hideTimeout()
  clearTimeout(stateTimeout)
}

function SetMode(mode) {
  Conf.maxNumber = mode.maxNumber
  document.getElementById('input_maxNumber').value = Conf.maxNumber
  document.documentElement.style.background = mode.background
  document.documentElement.style.color = mode.color
}

function SetConf(conf, confGM) {
  Conf = conf
  document.getElementById('input_maxNumber').value = Conf.maxNumber
  ConfGM = confGM
  if (!ConfGM && IsShown('panel'))
    HideDiv('panel')
  if (ConfGM) {
    document.getElementById('input_waitingTime').value = ConfGM.waitingTime
    document.getElementById('input_waitingTime2').value = ConfGM.waitingTime2
    document.getElementById('button_enableOverwrite').innerHTML = ConfGM.enableOverwrite ? 'Overwrite: on' : 'Overwrite: off'
    document.getElementById('button_sendFake').innerHTML = ConfGM.sendFake ? 'SendFake: on' : 'SendFake: off'
    document.getElementById('button_doubleBlind').innerHTML = ConfGM.doubleBlind ? 'DoubleBlind: on' : 'DoubleBlind: off'
    document.getElementById('button_randomize').innerHTML = ConfGM.randomize ? 'Randomize: on' : 'Randomize: off'
    document.getElementById('button_enableOverwriteGM').innerHTML = ConfGM.enableOverwriteGM ? 'OverwriteGM: on' : 'OverwriteGM: off'
    SetDivI(ConfGM.sendFake, 'button_doubleBlind')
    SetDivI(ConfGM.sendFake, 'button_resetCount')
    SetDivI(ConfGM.sendFake, 'button_randomize')
  }
}

function SetGM(isgm) {
  isGM = isgm
  SetDiv(isGM, 'gmtag')
  SetDivI(isGM, 'button_dropGM')
}

function SendState(state = -1) {
  if (state == -1)
    socket.emit('packet', { now: { state, bol: state !== 0 }, next: { bell: true, delay: 1 } })
  else
    socket.emit('packet', { now: { state, bol: state !== 0, bell: false } })
}
let SendWait = () => socket.emit('packet', { now: { state: 0 }, next: { delay: 2 } })
let SendMode = mode => socket.emit('mode', { mode })
let SendMaxNumber = () => socket.emit('maxNumber', { maxNumber: document.getElementById('input_maxNumber').value })
let SendWaitingTime = () => socket.emit('waitingTime', { waitingTime: document.getElementById('input_waitingTime').value })
let SendWaitingTime2 = () => socket.emit('waitingTime2', { waitingTime2: document.getElementById('input_waitingTime2').value })
let SendEnableOverwrite = enableOverwrite => socket.emit('enableOverwrite', { enableOverwrite })
let SendSendFake = sendFake => socket.emit('sendFake', { sendFake })
let SendDoubleBlind = doubleBlind => socket.emit('doubleBlind', { doubleBlind })
let SendResetCount = () => socket.emit('resetCount')
let SendRandomize = randomize => socket.emit('randomize', { randomize })
let SendEnableOverwriteGM = enableOverwriteGM => socket.emit('enableOverwriteGM', { enableOverwriteGM })
let SendGetGM = () => { if (!isGM) socket.emit('getGM'); else SendDropGM() }
let SendDropGM = () => { if (isGM) socket.emit('dropGM') }

socket.on('node', data => {
  //console.log(data)
  if (data.html)
    renderMain(data.html)
  if (data.html2) {
    if (data.html2 === hide)
      hideSecond()
    else renderSecond(data.html2)
  }
  if (data.html3) {
    if (data.html3 === hide)
      hideThird()
    else renderThird(data.html3)
  }
  if (data.count) {
    if (data.count === hide)
      hideCount()
    else renderCount(data.count)
  }
  if (data.bell)
    Bell()
  if (data.bol)
    Bol()
  if (data.delay)
    Wait(data.delay)
  else
    ClearTimeout()
})
socket.on('init', data => {
  renderMain(data.html)
  SetConf(data.conf, data.confGM)
  SetMode(data.mode)
})
socket.on('mode', data => SetMode(data.mode))
socket.on('conf', data => SetConf(data.conf, data.confGM))
socket.on('gm', data => SetGM(data.isGM))
