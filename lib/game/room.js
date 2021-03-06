/**
 * 房间定义
 */
const uniqid = require('uniqid');
const Engine = require("../engine/engine.js")
const SyncEventPool = require("./sync_event_pool.js")
var CenterHelper = require('../foundation/center_helper')

function Room(mgr, roomId, ownerId, roomName, isSupervisor) {
  this._uniq = uniqid()
  this._game = mgr._game
  this._roomMgr = mgr
  this.id = roomId
  this._state = app.consts.ROOM_STATE.INIT 

  this.gameId = this._game.id
  this.ownerId = ownerId
  this.roomName = roomName
  this.isSupervisor = isSupervisor    // 是否为监督节点room
  if(!isSupervisor) {
    this._syncEventPool = new SyncEventPool(this.gameId, roomId)
  }

  this._sendPending = []

  // 房间对应的engine
  this._engine = new Engine(this._game, this, roomName, isSupervisor)
}

/**
 * room 初始化
 */
Room.prototype.init = function() {
  logger.debug("房间:%s 进行初始化", this.id)
  if(!this.isSupervisor) {
    this._syncEventPool.start()
  }
  return this._engine.init()
}

Room.prototype.setState = function(state) {
  this._state = state
  if(state == app.consts.ROOM_STATE.START) {
    this._tryFlushSendPending()
  }
}

Room.prototype.getState = function() {
  return this._state
}

/**
 * 通过room 获取对应的game
 */
Room.prototype.getGame = function() {
  return this._game
}

/**
 * 获取用户列表
 */
Room.prototype.getUserList = function() {
  return this._engine.getusersid()
}

/**
 * room 关闭
 */
Room.prototype.closeRoom = function() {
  // 删除映射关系
  let matchResult = app.gameMgr.matchResult
  matchResult.deleteResult(this.id)
  matchResult.deleteRoomWorkType(this.id)

  let userList = this._engine.getusersid()
  logger.debug("room关闭房间:%s 房间内用户列表:", this.id, userList)
  for(let v of userList) {
    let user = this._game.userMgr.getUser(v)
    user.doLogout()
    matchResult.deleteRoomWorkTypeByUser(this.gameId, v)
  }
  this._engine.onclose()
  if(!this.isSupervisor) {
    this._syncEventPool.stop()
  }
  return true
}

/**
 * 玩家进入room
 * 被 roomMgr 调用
 * @param {string} userId
 */
Room.prototype.enterRoom = async function(userId) {
  return this._engine.enterRoom(userId)
}

/**
 * 玩家离开room
 * 由 roomMgr调用
 * @param {string} userId
 */
Room.prototype.leaveRoom = function(userId, reason) {
  let ret = this._engine.leaveRoom(userId)
  if(!ret) {
    return ret
  }
  // 房间人数为0，顺便关闭房间
  if(this._engine.getUserCount() == 0) {
    this._engine.close()
  }
  return true
}

/**
 * 当收到client的数据
 * @param {string} userId 
 * @param {string} key 
 * @param {string} value 
 */
Room.prototype.onClientMsg = function(userId, key, value) {
  if(key == "room.startgame") {
    // TODO: 处理帧同步及房间duration
  }
  return this._engine.onClientMsg(userId, key, value)
}

/**
 * 向client发送消息
 * @param {*} user 
 * @param {*} data 
 */
Room.prototype.send = function(user, data) {
  if(!this.isSupervisor) {
    if(this._state == app.consts.ROOM_STATE.START) {
      this._game.userMgr.send(user, data)
    } else {
      this._sendPending.push([user, data])
    }
  } else {
    // logger.debug("supervisor room send data to user, do nothing")
  }
}

/**
 * 同步事件到监督节点
 * @param {string} type 
 * @param {array} data 
 */
Room.prototype.syncEventToSup = function(type, data) {
  if(this.isSupervisor) {
    return
  }
  let frameCount = this._engine.getFrameCount()
  this._syncEventPool.addEvent(frameCount, type, data)
}

/**
 * 收到逻辑节点的事件
 * @param {*} frameCount
 * @param {*} type 
 * @param {*} data 
 */
Room.prototype.recvEventFromLogic = function(frameCount, type, data) {
  this._engine.recvEventFromLogic(frameCount, type, data)
}

Room.prototype._tryFlushSendPending = function() {
  logger.debug("room:%s 清空缓存的消息:", this.id, this._sendPending)
  let that = this._game.userMgr
  for(let elem of this._sendPending) {
    that.send.apply(that, elem)
  }
  this._sendPending.length = 0
}

/**
 * 检查输出
 */
Room.prototype.inspect2 = function() {
  let result = ''
  result += ' id:' + this.id
    + ' uniq:' + this._uniq
    + ' game:' + this.gameId
    + ' owner:' + this.ownerId
    + ' name:' + this.roomName
    + ' supervisor:' + this.isSupervisor
  return result
}

module.exports = Room