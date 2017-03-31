let express = require('express')
let app = express()
let bodyParser = require('body-parser')
let server = require('http').createServer(app)
let path = require('path')
let config = require('../config')

let ROOMs = {}

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

function CreateRoom(room) {
  ROOMs[room] = {
    room,
    state: 0,
    stateTimeout: null,
    mode: 2,
    maxNumber: 2,
    waitingTime: 20000,
    waitingTime2: 10000,
    enableOverwrite: false
  }
}

const cartes = [ 'Zener_Cercle.jpg', 'Zener_Croix.jpg', 'Zener_Vague.jpg', 'Zener_Carre.jpg', 'Zener_Etoile.jpg' ]
function GenHTML(Room, forceState=null) {
  let state = forceState || Room.state
  if (state < 1)
    return '<div class="txt">TRANSITION</div>'
  switch(Room.mode) {
    default:
    case 1: return '<div class="txt">'+state+'</div>' // Number
    case 2: return '<div class="txt">'+(state>1?'Non':'Oui')+'</div>' // Yes/No
    case 3: return '<img class="img" src="'+DATA_URL+'/symbol/'+cartes[state-1]+'">' // Zener
    case 4: return '<div class="txt">'+'0ABCDEFGHIJKLMNOPQRSTUVWXYZ'[state]+'</div>'
  }
}

function SetMode(Room, mode, maxNumber = null) {
  Room.mode = mode
  if (mode === 1) Room.maxNumber = maxNumber || 10
  else if (mode === 2) Room.maxNumber = 2
  else if (mode === 3) Room.maxNumber = 5
  else if (mode === 4) Room.maxNumber = 26
  // console.log('Mode change:', mode)
  io.to(Room.room).emit('mode', { mode: GetMode(Room) })
}

function GetMode(Room) {
  return {
    maxNumber: Room.maxNumber,
    background: Room.mode ===3 ? 'white' : 'black',
    color: Room.mode === 3 ? 'black' : 'white'
  }
}

function GetConf(Room) {
  return {
    maxNumber: Room.maxNumber,
    waitingTime: Room.waitingTime,
    waitingTime2: Room.waitingTime2,
    enableOverwrite: Room.enableOverwrite
  }
}

function SendConf(Room) {
  io.to(Room.room).emit('conf', { conf: GetConf(Room) })
}

function setState(Room, state, release=false) {
  Room.state = state
  // console.log('State change:', state)
  io.to(Room.room).emit('state', { state, html: GenHTML(Room), release })
}
function SetState(Room, state) {
  setState(Room, 0)
  clearTimeout(Room.stateTimeout)
  Room.stateTimeout =  setTimeout(()=>{ setState(Room, state, true); Room.stateTimeout = null }, state ? Room.waitingTime : Room.waitingTime2)
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
  socket.emit('init', { html: GenHTML(Room), mode: GetMode(Room), conf: GetConf(Room) })

  socket.on('state', function (data) {
    let state = data.state
    let instant = data.instant
    if (state == null)
      state = Math.floor(Math.random()*Room.maxNumber)+1
    if (state > -1 && state <= Room.maxNumber && (Room.enableOverwrite || !Room.stateTimeout)) {
      // console.log('Post received:', (instant?'':'not ')+'instant')
      if (instant > 0) {
        clearTimeout(Room.stateTimeout)
        setState(Room, state)
      }
      else {
        socket.emit('confirm', { html: GenHTML(Room, state), wait: Room.waitingTime })
        SetState(Room, state)
      }
    }
  })
  socket.on('wait', function (data) {
    socket.emit('confirm', { html: GenHTML(Room), wait: Room.waitingTime2 })
    SetState(Room, 0)
  })
  socket.on('mode', function (data) {
    if (data.mode > 0 && data.mode < 5)
      SetMode(Room, data.mode)
  })
  socket.on('maxNumber', function (data) {
    Room.maxNumber = data.maxNumber
    SendConf(Room)
  })
  socket.on('waitingTime', function (data) {
    Room.waitingTime = data.waitingTime
    SendConf(Room)
  })
  socket.on('waitingTime2', function (data) {
    Room.waitingTime2 = data.waitingTime2
    SendConf(Room)
  })
  socket.on('enableOverwrite', function (data) {
    Room.enableOverwrite = data.enableOverwrite
    SendConf(Room)
  })
})

server.listen(SERVER_PORT, function() {
  console.log('Server up! (port '+SERVER_PORT+')')
})
