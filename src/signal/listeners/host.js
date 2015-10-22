import config from 'signal/config';
import log from 'signal/utils/log';
import verify from 'shared/utils/verify';

const INVALID_KEY = new Error('Invalid key');

export default (socket, key, cb) => {
  const data = verify(config.key, key);
  if (!data || data.type !== 'host') return cb(INVALID_KEY);
  socket.host = {key, ...data};
  log.info([
    `${socket.id} is now a host`,
    `USER_ID=${data.userId}`,
    `REGION=${data.region}`,
    `NAME=${data.name}`,
    `URL=${data.url}`
  ].join('\n  '));
  cb();
};
