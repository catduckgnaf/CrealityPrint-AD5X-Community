import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sceneApi } from "../lib/sceneApi";
import { useScene } from "../state/store";

/** A non-printing visible marker on the selected object's top face, at its XY centre. */
export function CenterMarker() {
  const marker = useRef<THREE.Group>(null);
  const show = useScene(s => s.showCenter);
  const selection = useScene(s => s.selection);
  useFrame(({camera}) => {
    const group = marker.current;
    if (!group) return;
    if (!show || selection.length !== 1) { group.visible = false; return; }
    const box = sceneApi.getNodeBounds(selection[0]);
    if (!box || box.isEmpty()) { group.visible = false; return; }
    const center = box.getCenter(new THREE.Vector3());
    group.position.set(center.x, center.y, box.max.z + 0.8);
    const dist = camera.position.distanceTo(group.position);
    group.scale.setScalar(Math.max(0.75, Math.min(6, dist * 0.008)));
    group.visible = true;
  });
  return (
    <group ref={marker} visible={false}>
      <mesh raycast={() => null} renderOrder={1001}>
        <torusGeometry args={[3.0, 0.28, 5, 32]} />
        <meshBasicMaterial color="#ffc247" depthTest={false} depthWrite={false} />
      </mesh>
      <mesh raycast={() => null} renderOrder={1001}>
        <boxGeometry args={[10, 0.5, 0.5]} />
        <meshBasicMaterial color="#ffc247" depthTest={false} depthWrite={false} />
      </mesh>
      <mesh raycast={() => null} renderOrder={1001}>
        <boxGeometry args={[0.5, 10, 0.5]} />
        <meshBasicMaterial color="#ffc247" depthTest={false} depthWrite={false} />
      </mesh>
      <mesh raycast={() => null} renderOrder={1002}>
        <sphereGeometry args={[0.85, 10, 8]} />
        <meshBasicMaterial color="#ff653b" depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}
