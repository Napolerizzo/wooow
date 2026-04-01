'use client';

import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, OrbitControls } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';
import type { Database } from '@/types/database';

type Delegate = Database['public']['Tables']['delegates']['Row'];
type Mark = Database['public']['Tables']['marks']['Row'];
type SchemaField = Database['public']['Tables']['marking_schema']['Row'];

interface DelegateScore {
  delegate: Delegate;
  total: number;
  rank: number;
  awardTier?: string;
}

interface Props {
  scores: DelegateScore[];
  onSelectDelegate: (delegate: Delegate, score: number, rank: number) => void;
}

// Card dimensions
const CARD_W = 2.8;
const CARD_H = 1.2;
const CARD_Z_STEP = 0.4;
const Y_STEP = 1.6;

function DelegateCard({
  score,
  index,
  totalCount,
  isSelected,
  onClick,
}: {
  score: DelegateScore;
  index: number;
  totalCount: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Target position: rank 1 at top, higher ranks go down
  const targetY = (totalCount / 2 - index) * Y_STEP;
  const targetZ = -index * CARD_Z_STEP;

  // Idle float animation
  const floatOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.position.y +=
      (targetY + Math.sin(t * 0.6 + floatOffset) * 0.08 - meshRef.current.position.y) * 0.05;
  });

  // Spring to target position (handles rank changes)
  const { posY, posZ, rotX } = useSpring({
    posY: targetY,
    posZ: targetZ,
    rotX: isSelected ? -0.1 : 0,
    config: { tension: 120, friction: 20 },
  });

  const cardColor = useMemo(() => {
    if (score.rank === 1) return '#1a1a1a';
    if (score.rank === 2) return '#161616';
    if (score.rank === 3) return '#131313';
    return '#0f0f0f';
  }, [score.rank]);

  return (
    <animated.group position-z={posZ} position-y={posY} rotation-x={rotX}>
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        castShadow
      >
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial
          color={isSelected ? '#1e1e1e' : cardColor}
          emissive={isSelected ? '#111' : '#000'}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Card border */}
      <lineSegments>
        <edgesGeometry
          args={[new THREE.PlaneGeometry(CARD_W, CARD_H)]}
        />
        <lineBasicMaterial color={isSelected ? '#444' : '#222'} />
      </lineSegments>

      {/* Rank number */}
      <Text
        position={[-CARD_W / 2 + 0.25, 0, 0.01]}
        fontSize={0.35}
        color="#444"
        font="/fonts/special-elite.woff"
        anchorX="center"
        anchorY="middle"
      >
        {score.rank}
      </Text>

      {/* Delegate name */}
      <Text
        position={[-0.15, 0.18, 0.01]}
        fontSize={0.22}
        color="#f0ece4"
        maxWidth={CARD_W - 1.2}
        anchorX="left"
        anchorY="middle"
        textAlign="left"
      >
        {score.delegate.name}
      </Text>

      {/* Total score */}
      <Text
        position={[CARD_W / 2 - 0.25, 0.18, 0.01]}
        fontSize={0.28}
        color="#f0ece4"
        anchorX="right"
        anchorY="middle"
      >
        {score.total.toFixed(1)}
      </Text>

      {/* Award tier badge */}
      {score.awardTier && (
        <Text
          position={[-0.15, -0.18, 0.01]}
          fontSize={0.14}
          color="#666"
          anchorX="left"
          anchorY="middle"
          maxWidth={CARD_W - 0.5}
        >
          {score.awardTier.toUpperCase()}
        </Text>
      )}

      {/* Top 3 particle halo (simple glow rings) */}
      {score.rank <= 3 && (
        <mesh position={[0, 0, -0.05]}>
          <ringGeometry args={[CARD_W * 0.58, CARD_W * 0.6, 32]} />
          <meshBasicMaterial
            color="#f0ece4"
            transparent
            opacity={0.04 - score.rank * 0.01}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </animated.group>
  );
}

function SceneContent({ scores, onSelectDelegate }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { camera } = useThree();

  function handleCardClick(score: DelegateScore) {
    if (selectedId === score.delegate.id) {
      setSelectedId(null);
    } else {
      setSelectedId(score.delegate.id);
      onSelectDelegate(score.delegate, score.total, score.rank);
      // Move camera to focus
      const targetY = (scores.length / 2 - score.rank + 1) * Y_STEP;
      camera.position.set(0, targetY, 10);
    }
  }

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={0.6} />
      <pointLight position={[-5, -5, 3]} intensity={0.3} color="#8888ff" />

      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI * 0.3}
        maxPolarAngle={Math.PI * 0.7}
        minDistance={5}
        maxDistance={20}
      />

      {scores.map((score, i) => (
        <DelegateCard
          key={score.delegate.id}
          score={score}
          index={i}
          totalCount={scores.length}
          isSelected={selectedId === score.delegate.id}
          onClick={() => handleCardClick(score)}
        />
      ))}
    </>
  );
}

export default function ScoreboardScene({ scores, onSelectDelegate }: Props) {
  return (
    <Canvas
      camera={{ position: [0, 0, 12], fov: 55 }}
      style={{ background: '#080808', width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      <SceneContent scores={scores} onSelectDelegate={onSelectDelegate} />
    </Canvas>
  );
}

// Helper exports used by parent
export type { DelegateScore };
export function computeScores(
  delegates: Delegate[],
  marks: Mark[],
  schema: SchemaField[],
  awardTiers: { tier_name: string; rank_from: number; num_awards: number }[]
): DelegateScore[] {
  const totals = delegates.map((d) => {
    const total = schema.reduce((sum, field) => {
      const fieldMarks = marks.filter(
        (m) => m.delegate_id === d.id && m.schema_field_id === field.id && m.counts_toward_final
      );
      if (fieldMarks.length === 0) return sum;
      if (field.scoring_mode === 'average') {
        const scores = fieldMarks.map((m) => m.score);
        return sum + scores.reduce((a, b) => a + b, 0) / scores.length;
      }
      return sum + fieldMarks.reduce((s, m) => s + m.score, 0);
    }, 0);
    return { delegate: d, total };
  });

  // Sort descending
  totals.sort((a, b) => b.total - a.total);

  return totals.map(({ delegate, total }, i) => {
    const rank = i + 1;
    const tier = awardTiers.find(
      (t) => rank >= t.rank_from && rank < t.rank_from + t.num_awards
    );
    return { delegate, total, rank, awardTier: tier?.tier_name };
  });
}
