/**
 * 记录用户和房间的匹配映射关系
 */
function MatchResult() {
  this._userMap = new Map()   // userid -> room_hash
  this._roomMap = new Map()   // room_hash -> [userid]
}

/**
 * 保存映射结果
 * @param {*} roomHash 
 * @param {*} userIdList 
 */
MatchResult.prototype.store = function(roomHash, userIdList) {
  if(!roomHash || !userIdList || !Array.isArray(userIdList)) {
    logger.warn("match result store args bad! roomHash", roomHash, "userIdList", userIdList)
    return false
  }

  this._roomMap.set(roomHash, userIdList)
  for(let u of userIdList) {
    this._userMap.set(u, roomHash)
  }
  return true
}

/**
 * 当房间结束时，删除对应的房间映射关系
 * @param {*} roomHash 
 */
MatchResult.prototype.delete = function(roomHash) {
  let userIdList = this._roomMap.get(roomHash)
  if(!userIdList) {
    return false
  }
  this._roomMap.delete(roomHash)
  for(let u of userIdList) {
    this._userMap.delete(u)
  }
  return true
}

/**
 * 获取用户的room id
 * @param {*} userId 
 */
MatchResult.prototype.getRoomId = function(userId) {
  return this._userMap.get(userId)
}

/**
 * 获取房间的userid list
 */
MatchResult.prototype.getUserIdList = function(roomId) {
  return this._roomMap.get(roomId)
}

module.exports = new MatchResult