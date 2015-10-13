import _ from 'underscore';
import CAMERA from 'client/camera';
import ArenaLight from 'client/lights/arena';
import BallMesh from 'client/meshes/ball';
import ChassisMesh from 'client/meshes/chassis';
import FloorMesh from 'client/meshes/floor';
import Live from 'live';
import Peer from 'shared/peer';
import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import RENDERER from 'client/renderer';
import THREE from 'three';
import WheelMesh from 'client/meshes/wheel';
import WorldLight from 'client/lights/world';

const KEYS = {};

document.addEventListener('keydown',
  ({key, which}) => KEYS[key || which] = true
);
document.addEventListener('keyup',
  ({key, which}) => KEYS[key || which] = false
);

export default class extends Component {
  constructor(props) {
    super(props);
    this.worker = new Worker('worker.js');
    this.worker.onmessage = ::this.handleMessage;
    this.cars = {};
    this.peers = {};
    this.scene = new THREE.Scene();
    this.scene.add(WorldLight());
    this.scene.add(ArenaLight());
    this.scene.add(FloorMesh());
    this.ball = BallMesh();
    this.scene.add(this.ball);
    this.car = this.getCar('self');

    (this.live = new Live())
      .on('peers', ({self, rest}) => {
        this.live.id = self;
        const current = _.keys(this.peers);
        _.each(_.difference(current, rest), id => {
          this.getPeer(id).close();
          delete this.peers[id];
          const car = this.getCar(id);
          this.scene.remove(car.chassis.mesh);
          _.each(car.wheels, wheel => this.scene.remove(wheel.mesh));
          this.worker.postMessage({name: 'remove-car', data: {id}});
          delete this.cars[id];
        });
        _.each(_.difference(rest, current), id => {
          if (self > id) this.getPeer(id).call();
        });
      })
      .on('signal', ({id, data}) => this.getPeer(id).signal(data));
  }

  getPeer(id) {
    const {peers} = this;
    let peer = peers[id];
    if (peer) return peer;
    peer = peers[id] = new Peer();
    peer.id = id;
    return peer
      .on('signal', data => this.live.send('signal', {id, data}))
      // .on('u', _.bind(this.handleUpdate, this, id))
      // .on('b', _.bind(this.handleBallUpdate, this))
      .on('close', () => { if (this.live.id > id) this.getPeer(id).call(); });
  }

  getCar(id) {
    let car = this.cars[id];
    if (car) return car;
    const chassis = ChassisMesh();
    this.scene.add(chassis);
    this.worker.postMessage({name: 'add-car', data: {id}});
    return this.cars[id] = {
      id,
      chassis,
      wheels: _.times(4, () => {
        const mesh = WheelMesh();
        this.scene.add(mesh);
        return mesh;
      }),
      gas: 0,
      steering: 0,
      ballCam: true
    };
  }

  // handleUpdate(id, [px, py, pz, rx, ry, rz, rw, lx, ly, lz, ax, ay, az, g, s, hb]) {
  //   const car = this.getCar(id);
  //   car.chassis.body.setWorldTransform(
  //     new Ammo.btTransform(
  //       new Ammo.btQuaternion(rx, ry, rz, rw),
  //       new Ammo.btVector3(px, py, pz)
  //     )
  //   );
  //   car.chassis.body.setLinearVelocity(new Ammo.btVector3(lx, ly, lz));
  //   car.chassis.body.setAngularVelocity(new Ammo.btVector3(ax, ay, az));
  //   car.gas = g;
  //   car.steering = s;
  //   car.handbrake = hb;
  // }
  //
  // handleBallUpdate([px, py, pz, rx, ry, rz, rw, lx, ly, lz, ax, ay, az]) {
  //   const ball = this.ball;
  //   ball.body.setWorldTransform(
  //     new Ammo.btTransform(
  //       new Ammo.btQuaternion(rx, ry, rz, rw),
  //       new Ammo.btVector3(px, py, pz)
  //     )
  //   );
  //   ball.body.setLinearVelocity(new Ammo.btVector3(lx, ly, lz));
  //   ball.body.setAngularVelocity(new Ammo.btVector3(ax, ay, az));
  // }

  componentDidMount() {
    ReactDOM.findDOMNode(this).appendChild(RENDERER.domElement);
    this.renderMap();
  }

  componentWillUnmount() {
    cancelAnimationFrame(this.rafId);
    RENDERER.domElement.remove();
  }

  renderMap() {
    this.rafId = requestAnimationFrame(::this.renderMap);
    const pad = navigator.getGamepads()[0];
    if (KEYS[38]) this.car.gas = 1;
    else if (KEYS[40]) this.car.gas = -1;
    else if (pad) {
      const {6: reverse, 7: forward} = pad.buttons;
      this.car.gas = forward.value - reverse.value;
    } else this.car.gas = 0;

    if (KEYS[37]) this.car.steering = -1;
    else if (KEYS[39]) this.car.steering = 1;
    else if (pad) {
      const [steering] = pad.axes;
      this.car.steering = Math.abs(steering) < 0.2 ? 0 : steering;
    } else this.car.steering = 0;

    if (KEYS[16]) this.car.handbrake = true;
    else if (pad) this.car.handbrake = pad.buttons[2].pressed;
    else this.car.handbrake = false;

    if (KEYS[66]) this.car.boost = true;
    else if (pad) this.car.boost = pad.buttons[1].pressed;
    else this.car.boost = false;

    if (KEYS[32]) this.car.jump = true;
    else if (pad) this.car.jump = pad.buttons[0].pressed;
    else this.car.jump = false;

    if (KEYS[89] && !this.prevPressed) this.car.ballCam = !this.car.ballCam;
    else if (pad && pad.buttons[3].pressed && !this.prevPressed) {
      this.car.ballCam = !this.car.ballCam;
    }
    this.prevPressed = KEYS[89] || (pad && pad.buttons[3].pressed);

    this.worker.postMessage({
      name: 'update-car',
      data: _.pick(this.car, 'id', 'gas', 'steering', 'handbrake', 'boost', 'jump')
    });

    // const shouldSendBall = _.first(_.sortBy(
    //   [this.live.id].concat(_.map(this.peers, 'id'))
    // )) === this.live.id;
    _.each(this.peers, peer => {
      const car = this.car.chassis.body;
      let p = car.getWorldTransform().getOrigin();
      let r = car.getWorldTransform().getRotation();
      let l = car.getLinearVelocity();
      let a = car.getAngularVelocity();
      peer.send('u', [
        p.x(),
        p.y(),
        p.z(),
        r.x(),
        r.y(),
        r.z(),
        r.w(),
        l.x(),
        l.y(),
        l.z(),
        a.x(),
        a.y(),
        a.z(),
        this.car.gas,
        this.car.steering,
        this.car.handbrake
      ]);
      // if (!shouldSendBall) return;
      // const ball = this.ball.body;
      // p = ball.getWorldTransform().getOrigin();
      // r = ball.getWorldTransform().getRotation();
      // l = ball.getLinearVelocity();
      // a = ball.getAngularVelocity();
      // peer.send('b', [
      //   p.x(),
      //   p.y(),
      //   p.z(),
      //   r.x(),
      //   r.y(),
      //   r.z(),
      //   r.w(),
      //   l.x(),
      //   l.y(),
      //   l.z(),
      //   a.x(),
      //   a.y(),
      //   a.z()
      // ]);
    });

    this.updateCamera();
    RENDERER.render(this.scene, CAMERA);
  }

  handleMessage({data: {name, data}}) {
    switch (name) {
    case 'frame':
      const {ball, cars} = data;
      this.ball.position.set(ball[0], ball[1], ball[2]);
      this.ball.quaternion.set(ball[3], ball[4], ball[5], ball[6]);
      _.each(cars, (v, id) => {
        const car = this.cars[id];
        car.chassis.position.set(v[0], v[1], v[2]);
        car.chassis.quaternion.set(v[3], v[4], v[5], v[6]);
        _.each(car.wheels, (wheel, i) => {
          i *= 7;
          wheel.position.set(v[7 + i], v[8 + i], v[9 + i]);
          wheel.quaternion.set(v[10 + i], v[11 + i], v[12 + i], v[13 + i]);
        });
      });
    }
  }

  updateCamera() {
    const cp = this.car.chassis.position;
    if (this.car.ballCam) {
      const bp = this.ball.position;
      const back = bp.clone().setY(0).sub(cp.clone().setY(0)).setLength(5);
      CAMERA.position.x = cp.x - back.x;
      CAMERA.position.y = cp.y + 2;
      CAMERA.position.z = cp.z - back.z;
      CAMERA.lookAt(bp);
    } else {
      const q = this.car.chassis.quaternion;
      const r = new THREE.Euler().setFromQuaternion(q, 'YXZ');
      CAMERA.position.x = cp.x - Math.sin(r.y) * 5;
      CAMERA.position.y = cp.y + 2;
      CAMERA.position.z = cp.z - Math.cos(r.y) * 5;
      CAMERA.lookAt(cp.clone().add(new THREE.Vector3(0, 1, 0)));
    }
  }

  render() {
    return <div />;
  }
}
