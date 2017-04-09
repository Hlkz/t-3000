
var socket = io('', {
  path: document.getElementById('ioPath').getAttribute('value'),
  query: 'r_var='+window.location.pathname
})

// conf
let ALLOW_CMD_DELAY = 500 // ms
// Default values, equal to server default values
let MAX_NUMBER = 2
let WAITING_TIME = 20000
let WAITING_TIME2 = 10000
let ENABLE_OVERWRITE = false
// misc
let stateTimeout = null
let ALLOW_CMD = true

let GetDiv = id => document.getElementById(id)
let ShowDiv = (id, html=null) => {
  let el = GetDiv(id)
  el.style.display = 'block'
  if (html) el.innerHTML = html
}
let HideDiv = id => { GetDiv(id).style.display = 'none' }
let IsShown = id => GetDiv(id).style.display === 'block'
let renderMain = h => { ShowDiv('main', h) }
let renderSecond = h => { ShowDiv('second', h) }
let hideSecond = () => { HideDiv('second') }
let isSecondShown = () => IsShown('second')
let renderCount = h => { ShowDiv('count', h) }
let hideCount = () => { HideDiv('count') }

let keyEventListener =  event => {
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
  if (key == 13 || key == 32) // Enter Space
    SendState()
  else if (key > 47 && key < Math.min(58, 49+MAX_NUMBER)) // 123456789
    SendState(key-48)
  else if (key > 64 && key < Math.min(91, 65+MAX_NUMBER)) // alphabet
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
  if (!ALLOW_CMD) return
  SendState()
  ALLOW_CMD = false
  setTimeout(()=>{ ALLOW_CMD = true }, ALLOW_CMD_DELAY)
}
document.addEventListener('keydown', keyEventListener, true)
document.getElementById('topright').addEventListener('click', clickListener, false)

function Beep() {
  let audio = document.getElementById('audioFile')
  audio.load()
  audio.play()
  // new Audio('/jingle.mp3').play()
}

function TogglePanel() {
  if (IsShown('panel'))
    HideDiv('panel')
  else
    ShowDiv('panel')
}

function ToggleEnableOverwrite() {
  SendEnableOverwrite(!ENABLE_OVERWRITE)
}

function Wait(time) {
  renderCount('<div class="txt">'+Math.floor(time/1000)+'</div>')
  if (time > 999) {
    clearTimeout(stateTimeout)
    stateTimeout = setTimeout(()=>{ Wait(time-1000) }, 1000)
  }
  else
    hideCount()
}

function clearCount() {
  hideCount()
  clearTimeout(stateTimeout)
}

function SetMode(mode) {
  MAX_NUMBER = mode.maxNumber
  document.getElementById('input_maxNumber').value = MAX_NUMBER
  document.documentElement.style.background = mode.background
  document.documentElement.style.color = mode.color
}

function SetConf(conf) {
  MAX_NUMBER = conf.maxNumber
  WAITING_TIME = conf.waitingTime
  WAITING_TIME2 = conf.waitingTime2
  ENABLE_OVERWRITE = conf.enableOverwrite
  document.getElementById('input_maxNumber').value = MAX_NUMBER
  document.getElementById('input_waitingTime').value = WAITING_TIME
  document.getElementById('input_waitingTime2').value = WAITING_TIME2
  document.getElementById('button_enableOverwrite').innerHTML = ENABLE_OVERWRITE ? 'Overwrite: on' : 'Overwrite: off'
}

function SendState(state = -1) {
  if (state == -1)
    socket.emit('packet', { now: { state }, next: { bell: true, delay: 1 } })
  else
    socket.emit('packet', { now: { state, bell: true } })
}
function SendWait() {
  socket.emit('packet', { now: { state: 0 }, next: { bell: true, delay: 2 } })
}
function SendMode(mode) {
  socket.emit('mode', { mode })
}
function SendMaxNumber() {
  socket.emit('maxNumber', { maxNumber: document.getElementById('input_maxNumber').value })
}
function SendWaitingTime() {
  socket.emit('waitingTime', { waitingTime: document.getElementById('input_waitingTime').value })
}
function SendWaitingTime2() {
  socket.emit('waitingTime2', { waitingTime2: document.getElementById('input_waitingTime2').value })
}
function SendEnableOverwrite(enableOverwrite) {
  socket.emit('enableOverwrite', { enableOverwrite })
}

socket.on('node', data => {
  if (data.html)
    renderMain(data.html)
  if (data.html2)
    renderSecond(data.html2)
  if (data.bell)
    Beep()
  if (data.delay)
    Wait(data.delay)
  else
    clearCount()
})

socket.on('init', data => {
  renderMain(data.html)
  SetMode(data.mode)
  SetConf(data.conf)
})

socket.on('mode', data => {
  SetMode(data.mode)
})

socket.on('conf', data => {
  SetConf(data.conf)
})

socket.on('confirm', data => {
  renderSecond(data.html)
  Wait(data.wait)
})
