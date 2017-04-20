let express = require('express')
let app = express()
let bodyParser = require('body-parser')
let server = require('http').createServer(app)
let path = require('path')
let config = require('../config/config')

let ROOM = {} // Room prototype
let ROOMs = {} // Rooms by id
let hide = 'hide'

const ROOT = __dirname+'/../'
const SERVER_PORT = config.port
const PATH_NAME = config.pathname
const IO_PATH = PATH_NAME.length ? PATH_NAME+'/socket.io' : '/socket.io'
const DATA_URL = PATH_NAME.length ? PATH_NAME+'/data' : '/data'
let io = require('socket.io')(server, { path: IO_PATH })
app.set('port', SERVER_PORT)
app.use(PATH_NAME+'/data', express.static(ROOT+'data'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))
app.set('view engine', 'pug')
app.use(function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-cache')
  next()
})
app.get(PATH_NAME+'/*', function(req, res) {
  res.render(ROOT+'data/index', { ioPath: IO_PATH, dataUrl: DATA_URL })
})
app.get(PATH_NAME, function(req, res) {
  res.redirect(PATH_NAME+'/')
})

function isEmpty(obj) { return Object.keys(obj).length === 0 && obj.constructor === Object }

function CreateRoom(room) {
  ROOMs[room] = {
    room,
    state: 0,
    realState: 0,
    stateTimeout: null,
    mode: 2,
    maxNumber: 2,
    waitingTime: 20000,
    waitingTime2: 10000,
    enableOverwrite: false,
    sendFake: false,
    doubleBlind: false,
    count: 0,
    randomize: false,
    GM: null,
    enableOverwriteGM: false,
  }
  Object.setPrototypeOf(ROOMs[room], ROOM)
}

ROOM.getSocketIds = function() { return Object.keys(io.sockets.adapter.rooms[this.room].sockets) }

ROOM.isGM = function() { return socket => !this.GM || this.GM === socket.id }

ROOM.SetGM = function(id) {
  // id can be null
  this.GM = id
  this.getSocketIds().forEach(id => io.to(id).emit('gm', { isGM: this.GM === id }))
  this.SendConf()
}

const cartes = [ 'Zener_Cercle.jpg', 'Zener_Croix.jpg', 'Zener_Vague.jpg', 'Zener_Carre.jpg', 'Zener_Etoile.jpg' ]
ROOM.GenHTML = function(forceState=null) {
  let state = forceState != null ? forceState : this.state
  if (state < 1)
    return '<div class="txt">TRANSITION</div>'
  switch(this.mode) {
    default:
    case 1: return '<div class="txt">'+state+'</div>' // Number
    case 2: return '<div class="txt">'+(state>1?'Non':'Oui')+'</div>' // Yes/No
    case 3: return '<img class="img" src="'+DATA_URL+'/symbol/'+cartes[state-1]+'">' // Zener
    case 4: return '<div class="txt">'+'0ABCDEFGHIJKLMNOPQRSTUVWXYZ'[state]+'</div>' // Letter
  }
}

ROOM.GenString = function(forceState=null) {
  let state = forceState != null ? forceState : this.state
  if (state < 1)
    return 'Transition'
  switch(this.mode) {
    default:
    case 1: return state // Number
    case 2: return state>1?'Non':'Oui' // Yes/No
    case 3: return cartes[state-1] // Zener
    case 4: return '0ABCDEFGHIJKLMNOPQRSTUVWXYZ'[state] // Letter
  }
}

ROOM.SetMode = function(mode, maxNumber = null) {
  this.mode = mode
  if (mode === 1) this.maxNumber = maxNumber || 10
  else if (mode === 2) this.maxNumber = 2
  else if (mode === 3) this.maxNumber = 5
  else if (mode === 4) this.maxNumber = 26
  // console.log('Mode change:', mode)
  io.to(this.room).emit('mode', { mode: this.GetMode() })
}

ROOM.GetMode = function() {
  return {
    maxNumber: this.maxNumber,
    background: this.mode ===3 ? 'white' : 'black',
    color: this.mode === 3 ? 'black' : 'white'
  }
}

ROOM.GetConf = function() {
  return {
    maxNumber: this.maxNumber,
    count: this.count,
  }
}
ROOM.GetConfGM = function(id) {
  if (this.GM && this.GM != id)
    return null
  return {
    waitingTime: this.waitingTime,
    waitingTime2: this.waitingTime2,
    enableOverwrite: this.enableOverwrite,
    sendFake: this.sendFake,
    doubleBlind: this.doubleBlind,
    randomize: this.randomize,
    enableOverwriteGM: this.enableOverwriteGM,
  }
}

ROOM.SendConf = function() {
  this.getSocketIds().forEach(id => io.to(id).emit('conf', { conf: this.GetConf(), confGM: this.GetConfGM(id) }))
}

ROOM.treatPacket = function(node, sender) {
  if (!node || (!this.enableOverwrite && this.stateTimeout))
    return
  let state = node.state
  if (state != null && (state < -1 || state > this.maxNumber))
    return

  clearTimeout(this.stateTimeout)

  let bell = node.bell ? true : false
  let bol = node.bol ? true : false
  let delay = node.delay || 0

  if (state === null && !bell && !bol && !delay)
    return

  let sendFake, statehtml, realState, realStatehtml
  if (state === -1)
    state = Math.floor(Math.random()*this.maxNumber)+1
  if (state)
    sendFake = this.randomize ? Math.random() >= 0.5 : this.sendFake
  if (state && sendFake) {
    realState = state
    state = Math.floor(Math.random()*this.maxNumber)+1
  }
  if (state && this.doubleBlind)
      this.count++
  if (state != null)
    statehtml = this.GenHTML(state)
  if (realState != null)
    realStatehtml = this.GenHTML(realState)

  let exec = () => {
    if (state != null) 
      this.state = state
    this.getSocketIds().forEach(id => io.to(id).emit('node', { 
      html: sendFake && id === sender ? realStatehtml : statehtml,
      html3: state ? (sendFake && id === sender && !this.doubleBlind ? statehtml : hide) : 0,
      count: state ? (this.sendFake && this.doubleBlind && id === sender ? this.count : hide) : (state === 0 ? hide : 0),
      bell,
      bol,
    }))
    if (state && this.doubleBlind)
      console.log('Room:'+this.room, 'Essai:'+this.count, 'Real:'+this.GenString(realState), (sendFake ? 'Fake:'+this.GenString(state) : ''))
  }
  if (!delay)
    exec()
  else {
    delay = delay == 1 ? this.waitingTime : this.waitingTime2
    io.to(sender).emit('node', { delay })
    this.stateTimeout = setTimeout(() => { exec()
      this.stateTimeout = null }, delay)
  }
}

io.on('connection', function (socket) {
  let room = socket.handshake['query']['r_var']
  if (!room.startsWith(config.pathname))
    return
  room = room.slice(config.pathname.length)
  if (!ROOMs[room])
    CreateRoom(room)

  let Room = ROOMs[room]
  socket.join(room)
  socket.emit('init', { html: Room.GenHTML(), mode: Room.GetMode(), conf: Room.GetConf(), confGM: Room.GetConfGM(socket.id) })

  socket.on('disconnect', () => {
    if (Room.GM && Room.GM === socket.id)
      Room.SetGM(null)
  })
  socket.on('packet', data => {
    if (!Room.isGM(socket)) return
    Room.treatPacket(data.now, socket.id)
    Room.treatPacket(data.next, socket.id)
  })
  socket.on('mode', data => {
    if (!Room.isGM(socket)) return
    if (data.mode > 0 && data.mode < 5)
      Room.SetMode(data.mode)
  })
  socket.on('maxNumber', data => {
    if (!Room.isGM(socket)) return
    Room.maxNumber = data.maxNumber
    Room.SendConf()
  })
  socket.on('waitingTime', data => {
    if (!Room.isGM(socket)) return
    Room.waitingTime = data.waitingTime
    Room.SendConf()
  })
  socket.on('waitingTime2', data => {
    if (!Room.isGM(socket)) return
    Room.waitingTime2 = data.waitingTime2
    Room.SendConf()
  })
  socket.on('enableOverwrite', data => {
    if (!Room.isGM(socket)) return
    Room.enableOverwrite = data.enableOverwrite
    Room.SendConf()
  })
  socket.on('sendFake', data => {
    if (!Room.isGM(socket)) return
    Room.sendFake = data.sendFake
    if (!data.sendFake) {
      Room.doubleBlind = false
      Room.randomize = false
    }
    Room.SendConf()
  })
  socket.on('doubleBlind', data => {
    if (!Room.isGM(socket)) return
    Room.doubleBlind = data.doubleBlind
    Room.SendConf()
  })
  socket.on('resetCount', () => {
    if (!Room.isGM(socket)) return
    Room.count = 0
  })
  socket.on('randomize', data => {
    if (!Room.isGM(socket)) return
    Room.randomize = data.randomize
    Room.SendConf()
  })
  socket.on('enableOverwriteGM', data => {
    if (!Room.isGM(socket)) return
    Room.enableOverwriteGM = data.enableOverwriteGM
    Room.SendConf()
  })
  socket.on('getGM', () => {
    if (!Room.GM || (Room.GM !== socket.id && Room.enableOverwriteGM))
      Room.SetGM(socket.id)
  })
  socket.on('dropGM', () => {
    if (Room.GM && Room.GM === socket.id)
      Room.SetGM(null)
  })
})

server.listen(SERVER_PORT, () => {
  console.log('Server up! (port '+SERVER_PORT+')')
})
