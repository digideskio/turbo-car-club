import _ from 'underscore';
import Ammo from 'ammo';
import CAMERA from 'client/camera';
import ArenaLight from 'client/lights/arena';
import BallBody from 'shared/bodies/ball';
import BallMesh from 'client/meshes/ball';
import CarBody from 'shared/bodies/car';
import ChassisMesh from 'client/meshes/chassis';
import config from 'shared/config';
import createBody from 'shared/utils/create-body';
import FloorBody from 'shared/bodies/floor';
import FloorMesh from 'client/meshes/floor';
import Live from 'live';
import Peer from 'shared/peer';
import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import RENDERER from 'client/renderer';
import THREE from 'three';
import WheelMesh from 'client/meshes/wheel';
import WorldLight from 'client/lights/world';
import WorldObject from 'shared/objects/world';

const KEYS = {};

document.addEventListener('keydown',
  ({key, which}) => KEYS[key || which] = true
);
document.addEventListener('keyup',
  ({key, which}) => KEYS[key || which] = false
);

const WALLS = [
  [48, 1, 4],
  [51, 1, 2],
  [54, 1, 1],
  [57, 1, 1 / 2],
  [60, 1, 1 / 4],
  [64, 1, 0]
];

export default class extends Component {
  constructor(props) {
    super(props);
    this.cars = {};
    this.peers = {};
    this.world = WorldObject();
    this.world.addRigidBody(FloorBody());
    this.ball = {body: BallBody(), mesh: BallMesh()};
    this.ball.body.getWorldTransform().getOrigin().setX(-10);
    this.ball.body.getWorldTransform().getOrigin().setY(4);
    this.ball.body.getWorldTransform().getOrigin().setZ(-10);
    this.world.addRigidBody(this.ball.body);
    this.scene = new THREE.Scene();
    this.scene.add(WorldLight());
    this.scene.add(ArenaLight());
    this.scene.add(FloorMesh());
    this.scene.add(this.ball.mesh);
    this.car = this.getCar('self');
    this.car.chassis.body.getWorldTransform().getOrigin().setY(3);

    _.each(WALLS, ([d, x, y]) => {
      let body;
      this.world.addRigidBody(body = createBody({
        shape: new Ammo.btStaticPlaneShape(new Ammo.btVector3(x, y, 0), 0)
      }));
      body.getWorldTransform().getOrigin().setX(-d);
      this.world.addRigidBody(body = createBody({
        shape: new Ammo.btStaticPlaneShape(new Ammo.btVector3(-x, y, 0), 0)
      }));
      body.getWorldTransform().getOrigin().setX(d);
      this.world.addRigidBody(body = createBody({
        shape: new Ammo.btStaticPlaneShape(new Ammo.btVector3(0, y, x), 0)
      }));
      body.getWorldTransform().getOrigin().setZ(-d);
      this.world.addRigidBody(body = createBody({
        shape: new Ammo.btStaticPlaneShape(new Ammo.btVector3(0, y, -x), 0)
      }));
      body.getWorldTransform().getOrigin().setZ(d);
    });

    (this.live = new Live())
      .on('peers', ({self, rest}) => {
        this.live.id = self;
        const current = _.keys(this.peers);
        _.each(_.difference(current, rest), id => {
          this.getPeer(id).close();
          delete this.peers[id];
          const car = this.getCar(id);
          this.scene.remove(car.chassis.mesh);
          this.world.removeRigidBody(car.chassis.body);
          _.each(car.wheels, wheel => {
            this.scene.remove(wheel.mesh);
            this.world.removeRigidBody(wheel.body);
            this.world.removeConstraint(wheel.constraint);
          });
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
      .on('u', _.bind(this.handleUpdate, this, id))
      .on('b', _.bind(this.handleBallUpdate, this))
      .on('close', () => { if (this.live.id > id) this.getPeer(id).call(); });
  }

  getCar(id) {
    let car = this.cars[id];
    if (car) return car;
    const chassisMesh = ChassisMesh();
    this.scene.add(chassisMesh);
    const {vehicle, chassis} = CarBody(this.world);
    return this.cars[id] = {
      vehicle,
      chassis: {body: chassis, mesh: chassisMesh},
      wheels: _.times(4, () => {
        const mesh = WheelMesh();
        this.scene.add(mesh);
        return {mesh};
      }),
      gas: 0,
      steering: 0,
      ballCam: true
    };
  }

  handleUpdate(id, [px, py, pz, rx, ry, rz, rw, lx, ly, lz, ax, ay, az, g, s, hb]) {
    const car = this.getCar(id);
    car.chassis.body.setWorldTransform(
      new Ammo.btTransform(
        new Ammo.btQuaternion(rx, ry, rz, rw),
        new Ammo.btVector3(px, py, pz)
      )
    );
    car.chassis.body.setLinearVelocity(new Ammo.btVector3(lx, ly, lz));
    car.chassis.body.setAngularVelocity(new Ammo.btVector3(ax, ay, az));
    car.gas = g;
    car.steering = s;
    car.handbrake = hb;
  }

  handleBallUpdate([px, py, pz, rx, ry, rz, rw, lx, ly, lz, ax, ay, az]) {
    const ball = this.ball;
    ball.body.setWorldTransform(
      new Ammo.btTransform(
        new Ammo.btQuaternion(rx, ry, rz, rw),
        new Ammo.btVector3(px, py, pz)
      )
    );
    ball.body.setLinearVelocity(new Ammo.btVector3(lx, ly, lz));
    ball.body.setAngularVelocity(new Ammo.btVector3(ax, ay, az));
  }

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

    this.world.stepSimulation(1 / 60, 0, 1 / 60);
    _.each(this.cars, car => {
      const trans = car.chassis.body.getWorldTransform();
      const p = trans.getOrigin();
      car.chassis.mesh.position.set(p.x(), p.y(), p.z());
      const r = trans.getRotation();
      car.chassis.mesh.quaternion.set(r.x(), r.y(), r.z(), r.w());
      car.vehicle.setSteeringValue(-car.steering * config.car.steering, 0);
      car.vehicle.setSteeringValue(-car.steering * config.car.steering, 1);
      let grounded = 0;
      _.each(car.wheels, ({mesh}, i) => {
        const trans = car.vehicle.getWheelTransformWS(i);
        const p = trans.getOrigin();
        mesh.position.set(p.x(), p.y(), p.z());
        const r = trans.getRotation();
        mesh.quaternion.set(r.x(), r.y(), r.z(), r.w());
        const info = car.vehicle.getWheelInfo(i);
        if (i < 2) {
          car.vehicle.setBrake(car.handbrake ? 10 : 0, i);
          info.set_m_frictionSlip(
            car.handbrake ?
            config.car.handbrakeFrontFrictionSlip :
            config.car.frictionSlip
          );
        } else {
          car.vehicle.setBrake(car.handbrake ? 10 : 0, i);
          info.set_m_frictionSlip(
            car.handbrake ?
            config.car.handbrakeRearFrictionSlip :
            config.car.frictionSlip
          );
        }
        if (info.get_m_raycastInfo().get_m_isInContact()) ++grounded;
      });

      const b = car.chassis.body.getWorldTransform().getBasis();
      const f = new Ammo.btVector3(
        0,
        -grounded * config.car.sticky,
        car.boost ?
        config.car.boostAcceleration :
        grounded * car.gas * config.car.acceleration
      );
      car.chassis.body.applyCentralForce(
        new Ammo.btVector3(
          b.getRow(0).dot(f),
          b.getRow(1).dot(f),
          b.getRow(2).dot(f)
        )
      );

      if (grounded && car.jumpState >= 2) car.jumpState = 0;

      if (grounded === 4 && !car.jumpState && car.jump) {
        const b = car.chassis.body.getWorldTransform().getBasis();
        const f = new Ammo.btVector3(0, config.car.jump, 0);
        car.chassis.body.applyCentralImpulse(
          new Ammo.btVector3(
            b.getRow(0).dot(f),
            b.getRow(1).dot(f),
            b.getRow(2).dot(f)
          )
        );
        car.jumpState = 1;
      }

      if (!grounded && car.jumpState === 1) car.jumpState = 2;

      if (car.jumpState === 2 && !car.jump) car.jumpState = 3;

      if (grounded === 0 && car.jumpState === 3 && car.jump) {
        const b = car.chassis.body.getWorldTransform().getBasis();
        const f = new Ammo.btVector3(0, config.car.jump, 0);
        car.chassis.body.applyCentralImpulse(
          new Ammo.btVector3(
            b.getRow(0).dot(f),
            b.getRow(1).dot(f),
            b.getRow(2).dot(f)
          )
        );
        car.jumpState = 4;
      }
    });

    const shouldSendBall = _.first(_.sortBy(
      [this.live.id].concat(_.map(this.peers, 'id'))
    )) === this.live.id;
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
      if (!shouldSendBall) return;
      const ball = this.ball.body;
      p = ball.getWorldTransform().getOrigin();
      r = ball.getWorldTransform().getRotation();
      l = ball.getLinearVelocity();
      a = ball.getAngularVelocity();
      peer.send('b', [
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
        a.z()
      ]);
    });

    const origin = this.ball.body.getWorldTransform().getOrigin();
    this.ball.mesh.position.set(origin.x(), origin.y(), origin.z());
    const r = this.ball.body.getWorldTransform().getRotation();
    this.ball.mesh.quaternion.set(r.x(), r.y(), r.z(), r.w());

    this.updateCamera();
    RENDERER.render(this.scene, CAMERA);
  }

  updateCamera() {
    const cp = this.car.chassis.mesh.position;
    if (this.car.ballCam) {
      const bp = this.ball.mesh.position;
      const back = bp.clone().setY(0).sub(cp.clone().setY(0)).setLength(5);
      CAMERA.position.x = cp.x - back.x;
      CAMERA.position.y = cp.y + 2;
      CAMERA.position.z = cp.z - back.z;
      CAMERA.lookAt(bp);
    } else {
      const q = this.car.chassis.mesh.quaternion;
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
