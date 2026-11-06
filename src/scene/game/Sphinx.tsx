import { useCallback, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { QUIZ, QUIZ_DOOR_HALF, QUIZ_DOOR_XS, QUIZ_WALL_HALF_DEPTH, quizWalls } from '../../game/course'
import { run } from '../../game/run'
import { COLORS, FONT } from '../../lib/brand'
import { useLogoImage } from '../../ui/art/RingoutLogo'
import { Ink } from '../ink'
import { Label } from '../Label'
import { useCanvasTexture } from '../useCanvasTexture'
import { OnCourse } from './onCourse'

const WALL_HEIGHT = 3.2
const DOOR_LABELS = ['왼쪽', '가운데', '오른쪽']
const DOOR_COLORS = ['#FFB4A2', '#FFE08A', '#A8D8FF']

/** 링아웃 로고 얼굴. 문제를 내는 동안 입처럼 깜빡인다. */
function LogoFace() {
  const logo = useLogoImage()
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2)
      ctx.fill()
      if (logo) ctx.drawImage(logo, 40, 40, w - 80, h - 80)
    },
    [logo],
  )
  const texture = useCanvasTexture(draw, 512, 512)
  return (
    <mesh>
      <circleGeometry args={[3, 48]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  )
}

/** 스핑크스 앞에 걸린 문제판. 내 화면에 나온 문제를 쓴다. */
function QuestionBoard({ question }: { question: string | null }) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = '#FFF6C9'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = COLORS.ink
      ctx.lineWidth = 10
      ctx.strokeRect(5, 5, w - 10, h - 10)
      ctx.textAlign = 'center'
      ctx.fillStyle = COLORS.accent
      ctx.font = `bold 52px ${FONT}`
      ctx.fillText('링아웃 스핑크스의 넌센스 퀴즈!', w / 2, 74)
      ctx.fillStyle = COLORS.ink
      ctx.font = `bold 70px ${FONT}`
      ctx.fillText(question ?? '가까이 오면 문제를 낼게요', w / 2, 170, w - 60)
    },
    [question],
  )
  const texture = useCanvasTexture(draw, 1024, 230)
  return (
    <mesh>
      <planeGeometry args={[14, 3.15]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}

/**
 * 링아웃 스핑크스: 거대한 링아웃 로고가 넌센스 퀴즈를 내고, 세 통로 중 정답 통로만 지나갈 수 있다.
 * 문제는 사람마다 따로 나오므로, 통로 위 보기도 내 화면의 문제를 따른다.
 */
export function Sphinx() {
  const [quiz, setQuiz] = useState(run.quiz)
  const face = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (run.quiz !== quiz) setQuiz(run.quiz)
    if (face.current) {
      face.current.position.y = 9.5 + Math.sin(clock.elapsedTime * 1.6) * 0.25
      face.current.rotation.z = Math.sin(clock.elapsedTime * 0.9) * 0.05
    }
  })
  const gate = QUIZ
  if (!gate) return null
  const sides = [-1, 1]
  return (
    <>
      <OnCourse z={gate.wallZ}>
        {quizWalls().map((wall) => (
          <mesh key={wall.x} position={[wall.x, WALL_HEIGHT / 2, 0]}>
            <boxGeometry args={[wall.hx * 2, WALL_HEIGHT, QUIZ_WALL_HALF_DEPTH * 2]} />
            <Ink color="#E9D7B9" thickness={2.4} />
          </mesh>
        ))}
        {/* 통로 위 보기 */}
        {QUIZ_DOOR_XS.map((x, i) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, WALL_HEIGHT + 0.2, 0]}>
              <boxGeometry args={[QUIZ_DOOR_HALF * 2 + 0.6, 0.4, QUIZ_WALL_HALF_DEPTH * 2 + 0.1]} />
              <Ink color={DOOR_COLORS[i]} thickness={2.4} />
            </mesh>
            {sides.map((side) => (
              <mesh key={side} position={[side * (QUIZ_DOOR_HALF + 0.15), WALL_HEIGHT / 2, 0]}>
                <boxGeometry args={[0.3, WALL_HEIGHT, QUIZ_WALL_HALF_DEPTH * 2 + 0.1]} />
                <Ink color={DOOR_COLORS[i]} thickness={2.4} />
              </mesh>
            ))}
            <Label text={quiz ? `${DOOR_LABELS[i]}: ${quiz.options[i]}` : DOOR_LABELS[i]} position={[0, WALL_HEIGHT + 1.1, 0.6]} size={0.5} background={DOOR_COLORS[i]} />
            {/* 바닥 문양: 들어가면 정답인지 알 수 없다! */}
            <mesh position={[0, 0.03, 1.4]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[QUIZ_DOOR_HALF * 2, 2.6]} />
              <meshBasicMaterial color={DOOR_COLORS[i]} transparent opacity={0.5} />
            </mesh>
          </group>
        ))}
        {/* 거대한 링아웃 로고 스핑크스 */}
        <group ref={face} position={[0, 9.5, -1.5]}>
          <mesh position={[0, 0, -0.15]}>
            <circleGeometry args={[3.25, 48]} />
            <meshBasicMaterial color={COLORS.ink} />
          </mesh>
          <LogoFace />
          {sides.map((side) => (
            <mesh key={side} position={[side * 3.4, -1.2, 0]} rotation={[0, 0, side * -0.5]}>
              <boxGeometry args={[0.5, 2.6, 0.5]} />
              <Ink color={COLORS.accent} thickness={2.2} />
            </mesh>
          ))}
        </group>
        <group position={[0, 5.2, 0.4]}>
          <QuestionBoard question={quiz?.question ?? null} />
        </group>
      </OnCourse>
      {/* 스핑크스 구간 입구의 받침돌 */}
      {sides.map((side) => (
        <OnCourse key={side} x={side * 12} z={gate.from - 3}>
          <mesh position={[0, 1.2, 0]}>
            <boxGeometry args={[1.6, 2.4, 1.6]} />
            <Ink color="#E9D7B9" thickness={2.2} />
          </mesh>
          <Label text="❓" position={[0, 3.1, 0]} size={0.7} background={null} />
        </OnCourse>
      ))}
    </>
  )
}
