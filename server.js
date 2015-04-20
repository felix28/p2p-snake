var port = process.env.PORT || 3030
var express = require('express')
var app = express()
var server = require('http').Server(app)
var p2pserver = require('socket.io-p2p-server').Server
var io = require('socket.io')(server)
var p2pclients = require('socket.io-p2p-server').clients
var debug = require('debug')
var hat = require('hat')
app.use(express.static(__dirname+'/public'))

var rooms = []
var clients = {}

server.listen(port, function() {
  console.log("Listening on %s", port);
});

io.on('connection', function(socket) {
  clients[socket.id] = socket
  var room = findOrCreateRoom()
  console.log(room);
  socket.join(room.name)
  room.players++
  if (room.players === 1) {
    socket.emit('waiting')
  }
  console.log("joined %s", room.name);
  console.log(rooms);
  socket.on('error', function (err) {
    console.log("Error %s", err);
  })

  p2pserver(socket, null, room)

  socket.on('disconnect', function () {
    delete clients[socket.id]
    removePlayerOrRoom(room)
    io.to(room.name).emit('disconnected-player')
    // Move opponents to new rooms
    var opponents = io.nsps['/'].adapter.rooms[room.name]
    if (opponents) { // in case both players leave at the same time
      Object.keys(opponents).forEach(function (clientId, i) {
        room = findEmptyRoom()
        if (clients[clientId] && room) {
          socket.emit('initiator', 'true')
          clients[clientId].join(room.name)
        }
      })
    }
  })

  var numClients = Object.keys(io.nsps['/'].adapter.rooms[room.name]).length
  if (numClients == 2) {
    socket.emit('initiator', 'true')
  }
})

function findOrCreateRoom () {
  var lastRoom = findEmptyRoom()
  if (!lastRoom || lastRoom.full) {
    var room = {players: 0, name: hat()}
    return addRoom(room)
  }
  return lastRoom
}

function findEmptyRoom() {
  return rooms.filter(function(room) { return room.players === 1 })[0];
}

function removePlayerOrRoom (room) {
  room.players--
  if (room.players === 0) rooms.splice(room)
}

function addRoom(room) {
  rooms.push(room)
  return rooms[rooms.length - 1]
}
