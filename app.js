const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);


var rooms = [];
var connections = {}


// Endpoint para checar se a sala existe
app.get('/roomExists', (req, res) => {
  const roomCode = req.query.roomCode; // Pega o roomCode dos parâmetros da query string
  var exists = false
  for (var i=0; i<rooms.length; i++){
    if (rooms[i].roomCode === roomCode){
        exists = true;
        break;
    }
  }
  //console.log(exists)
  res.json({result: exists});
});


io.on('connection', (socket) => {
  console.log('A user connected', socket.id);

  // cria um sala (creators)
  socket.on('create_room', (roomCode) => {
    //console.log(`Room created with code: ${roomCode}`, socket.id);
    var free_code = true;
    for (var i=0; i<rooms.length; i++){
        if (rooms[i].roomCode === roomCode){
            //console.log('sala ja existe!', rooms[i]);
            free_code = false
            break;
        }
    }
    if (free_code){
        rooms.push({"creator_id": socket.id, "roomCode": roomCode, "book": '', "chapter": 0});
        connections[rooms[i].roomCode] = [];
        console.log('sala criada com sucesso!');
    }
  });

  // entra numa sala (followers)
  socket.on('enter_room', (roomCode) => {
    for (var i=0; i<rooms.length; i++){
        if (rooms[i].roomCode === roomCode){
          connections[rooms[i].roomCode].push(socket)
          break;
        }
    }
  });

  function emitToFollowers(room){
    const followers = connections[room.roomCode];
    for (var j=0; j<followers.length; j++){
      followers[j].emit('reference', {
        "roomCode": room.roomCode, 
        "book": room.book,
        "chapter": room.chapter
      });
    }
  }

  // muda a referencia de uma sala (creators)
  socket.on('set_reference', ({roomCode, book, chapter}) => {
    //console.log(`Room: ${roomCode}, Book: ${book}, Chapter: ${chapter}`);
    var reference = {"creator_id": socket.id, "roomCode": roomCode, "book": book, "chapter": chapter}
    for (var i=0; i<rooms.length; i++){
        if (rooms[i].roomCode === roomCode && rooms[i].creator_id === socket.id){
          rooms[i] = reference;
          // console.log("atualizando referencia:", reference)
          // emite para os followers
          emitToFollowers(rooms[i])
          break;
        }
    }
  });

  // envia de volta para o socket que requisitou
  socket.on('get_reference', (roomCode) => {
    for (var i=0; i<rooms.length; i++){
        if (rooms[i].roomCode === roomCode){
          // console.log("devolvendo referencia:", {
          //   "roomCode": rooms[i].roomCode, 
          //   "book": rooms[i].book,
          //   "chapter": rooms[i].chapter
          // })
          socket.emit('reference', {
            "roomCode": rooms[i].roomCode, 
            "book": rooms[i].book,
            "chapter": rooms[i].chapter
          });
          break;
        }
    }
  });

  function dropFollowers(room){
    const followers = connections[room.roomCode];
    for (var j=0; j<followers.length; j++){
      followers[j].emit('close_room', 200);
    }
    connections[room.roomCode] = [];
  }

  socket.on('disconnect', () => {
    console.log('A user disconnected');
    // remove a sala caso seja um creator
    for (var i=0; i<rooms.length; i++) {
      if (rooms[i].creator_id === socket.id){
        dropFollowers(rooms[i]);
        console.log("sala deletada!", rooms[i].roomCode)
        rooms.splice(i, 1)
        //console.log(rooms.length)
        break;
      }
    }

    // AS CONECTION NUNCA SÃO REMOVIDAS, POIS O PRÓXIMO SOCKET É ALEATÓRIO.
    // SE QUISER FAZER UM TRATAMENTO 100%, DEVE TRATAR REMOVENDO A
    // CONECTION DA LISTA DE CONECTIONS DA SALA (connections[rooms[0].roomCode])
    //console.log("NUMERO DE CONECTIONS:", connections[rooms[0].roomCode].length)
  });
});



const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server is running on port', PORT);
});