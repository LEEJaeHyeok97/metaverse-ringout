/**
 * 링아웃 소개 문구와 앱 화면. 내용은 링아웃 소개 사이트(https://www.ringout.my)를 따른다.
 * 기획 문구가 바뀌면 여기만 고친다.
 */
import alarmScreen from '../assets/ringout/alarm-screen.jpg'
import alarmSetting from '../assets/ringout/alarm-setting.jpg'
import destination from '../assets/ringout/destination.jpg'
import destinationInProgress from '../assets/ringout/destination-in-progress.jpg'
import groupActivity from '../assets/ringout/group-activity.jpg'
import groupDetail from '../assets/ringout/group-detail.jpg'
import groupList from '../assets/ringout/group-list.jpg'
import recordsCalendar from '../assets/ringout/records-calendar.jpg'
import recordsDaily from '../assets/ringout/records-daily.jpg'

export const RINGOUT_SITE = 'https://www.ringout.my'
export const APP_STORE_URL = 'https://apps.apple.com/kr/app/id6801441994?pt=129294547&ct=metaverse&mt=8'
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.joon.ringout&referrer=utm_source%3Dringout_world%26utm_medium%3Dmetaverse%26utm_campaign%3Dringout_world'

export const SCREENS = {
  alarmScreen,
  alarmSetting,
  destination,
  destinationInProgress,
  groupList,
  groupDetail,
  groupActivity,
  recordsDaily,
  recordsCalendar,
}

export type Board = {
  title: string
  /** 게시판에 크게 쓰는 세 줄 */
  lines: readonly string[]
  /** 자세히 보기 창의 설명 */
  detail: readonly string[]
  /** 자세히 보기 창에 함께 보여 줄 앱 화면 */
  screens: readonly { src: string; caption: string }[]
}

export const INTRO_BOARDS: readonly Board[] = [
  {
    title: '① 시간과 목표 지점을 함께',
    lines: ['알람 시간, 목표 지점,', '제한 시간을', '내일 계획에 맞게 정해요'],
    detail: [
      '눈을 뜨는 것과 계획을 시작하는 건 다르니까.',
      '링아웃은 자기 전에 알람 시간과 함께 목표 지점과 제한 시간을 정해요. 헬스장, 러닝 코스, 스터디카페처럼 아침의 첫 행동을 시작할 곳이요.',
    ],
    screens: [
      { src: alarmSetting, caption: '알람 설정' },
      { src: destination, caption: '목표 지점 설정' },
    ],
  },
  {
    title: '② 알람을 끄면 도착 미션',
    lines: ['알람 해제와 동시에', '목표 지점까지', '도착 미션이 시작돼요'],
    detail: [
      '일반 알람은 울림 → 해제로 끝나요. 링아웃은 울림 → 해제 → 도착 미션 → 목표 지점까지 이어져요.',
      '남은 시간과 목표 지점까지의 거리를 보며 이동해요.',
    ],
    screens: [
      { src: alarmScreen, caption: '알람 화면' },
      { src: destinationInProgress, caption: '도착 미션 진행 중' },
    ],
  },
  {
    title: '③ 못 가면 다시 울려요',
    lines: ['제한 시간 안에', '도착하지 못하면', '알람이 다시 울려요'],
    detail: [
      '알람을 끄면 제한 시간이 다시 시작되고, 도착 미션이 이어져요.',
      '"5분만 더"로 다시 잠드는 아침은 이제 그만. 목적지에 도착하면 더 이상 반복해서 울리지 않아요.',
    ],
    screens: [{ src: destinationInProgress, caption: '남은 시간과 거리' }],
  },
  {
    title: '④ 모임과 함께',
    lines: ['아침 러닝, 헬스장, 공부', '같은 목표를 가진 사람들과', '서로의 실천을 확인해요'],
    detail: [
      '내 목표에 맞는 모임을 찾거나 직접 만들어요. 모임의 요일과 시간, 소개를 보고 참여해요.',
      '누가 출발하고 목표 지점에 도착했는지 모임 안에서 함께 확인해요. 이 출근 레이스처럼요!',
    ],
    screens: [
      { src: groupList, caption: '모임 찾기' },
      { src: groupDetail, caption: '모임 소개' },
      { src: groupActivity, caption: '서로의 실천' },
    ],
  },
  {
    title: '⑤ 기록으로 돌아봐요',
    lines: ['알람이 몇 번 울렸는지', '언제 도착했는지', '하루와 한 달을 한눈에'],
    detail: ['오늘 알람이 몇 번 울렸는지, 언제 목적지에 도착했는지 하루의 활동 내역으로 확인해요.', '월별 달력으로 지난날의 실천을 돌아봐요.'],
    screens: [
      { src: recordsDaily, caption: '하루 기록' },
      { src: recordsCalendar, caption: '월별 달력' },
    ],
  },
  {
    title: '출근 레이스 하는 법',
    lines: ['가운데 발판에서 방에 모여요', '5명이 모이면 각자 집에서', '알람과 함께 출발!'],
    detail: [
      '아래쪽 주황 발판을 밟거나 "출근 레이스" 버튼으로 대기실을 열어요. 5명이 모이면 자동으로, 방장이 누르면 바로 출발해요.',
      '알람이 울리면 일어나 책상 위 휴대폰의 링아웃으로 목표 지점(우테코 캠퍼스)과 제한 시간을 정하고 알람을 끄면 도착 미션 시작!',
      '제한 시간마다 알람이 다시 울려요. 길 위의 🎁 아이템(E), 👊 때리기(F), 🦶 발차기(G), 2단 점프(스페이스 두 번)로 먼저 도착해 보세요.',
      '길가의 🚲 따릉이, 🛵 스쿠터, 🚗 경차, 🏎️ 스포츠카, 🚚 트럭은 스페이스로 타요. 차로 사람을 치면 기절해요!',
      '캠퍼스 바로 앞에는 🗿 링아웃 스핑크스가 넌센스 퀴즈를 내요. 정답 통로로만 지나갈 수 있어요.',
      '길 한가운데 🛝 대왕 미끄럼틀은 계단을 올라 쭉 타고 내려가요. 1등이 도착하면 10초 안에 들어와야 해요!',
      '출근길은 ☀️ 판교 출근길, ☔ 비 오는 월요일, 🍁 단풍 공원길, ❄️ 첫눈 오는 날 중 하나가 판마다 무작위로 골라져요. 맵마다 장애물 순서와 길 모양이 달라요.',
    ],
    screens: [],
  },
]

export const PHONE_SCREEN = {
  time: '08:25',
  destination: '우테코 캠퍼스',
  caption: '도착해야 끝나는 알람',
  detail: ['목표 지점에 도착해야 끝나는 알람, 링아웃.', '알람을 끄면 도착 미션이 시작돼요. 자기 전에 정한 장소로 움직이며 아침 계획의 첫 행동을 시작해요.', '아래 버튼으로 알람 소리를 들어 보세요.'],
}

/**
 * 게임 중 화면 옆에 잠깐 뜨는 링아웃 가이드. 게임의 순간과 앱의 기능을 짝지었다.
 * Runner와 HUD가 id로 띄운다.
 */
export const GUIDES = {
  alarm: {
    title: '링아웃 알람이 울려요',
    text: '실제 앱에서는 알람을 끄면 바로 목표 지점까지의 도착 미션이 시작돼요.',
    screen: alarmScreen,
  },
  mission: {
    title: '도착 미션 시작!',
    text: '앱에서는 남은 시간과 목표 지점까지의 거리를 보며 이동해요. 왼쪽 위 카드가 그 화면이에요.',
    screen: destinationInProgress,
  },
  reRing: {
    title: '제한 시간이 지나면 다시 울려요',
    text: '제한 시간 안에 도착하지 못하면 알람이 다시 울리고, 끄면 제한 시간이 다시 시작돼요.',
    screen: alarmScreen,
  },
  group: {
    title: '모임에서 함께 출발',
    text: '링아웃 모임에서는 같은 목표를 가진 사람들이 누가 출발하고 도착했는지 서로 확인해요.',
    screen: groupActivity,
  },
  groupFind: {
    title: '내 목표에 맞는 모임',
    text: '아침 러닝, 헬스장, 공부까지. 모임의 요일과 시간을 보고 참여하거나 직접 만들어요.',
    screen: groupList,
  },
  arrive: {
    title: '도착하면 알람이 끝나요',
    text: '설정한 목표 지점에 도착하면 더 이상 알람이 울리지 않아요. 오늘의 기록도 남아요.',
    screen: recordsDaily,
  },
} as const

export type GuideId = keyof typeof GUIDES

export const GAME_TIPS = [
  '링아웃은 제한 시간마다 다시 울려요. 울릴 때마다 정신이 번쩍! 잠깐 빨라져요.',
  '넘어져 있어도 알람이 울리면 바로 일어나요.',
  '빨간불에 움직이면 신호등 처음으로 돌아가요.',
  '공사장 허들은 스페이스로 뛰어넘어요.',
  '길가의 따릉이 앞에서 스페이스를 누르면 쌩쌩 달려요.',
  '🎁 아이템 상자를 지나가면 아이템을 받아요. E로 사용!',
  'F 키로 옆 사람을 때리면 잠깐 기절해요. 맞은 뒤 3초는 무적!',
  'G 키 발차기는 조금 더 멀리 닿고, 맞은 사람이 뒤로 날아가요.',
  '공중에서 스페이스를 한 번 더 누르면 2단 점프!',
  '🚗 차를 타고 사람을 치면 기절! 🚚 트럭이 가장 세고 🏎️ 스포츠카가 가장 빨라요.',
  '🍄 거인 버섯을 먹으면 부딪힌 사람을 튕겨내고, 👻 유령은 무엇이든 통과해요.',
  '🛝 대왕 미끄럼틀에서는 좌우로만 움직일 수 있어요. 슈우웅~',
  '🏁 1등이 도착하면 10초 카운트다운! 그 안에 못 들어오면 게임이 끝나요.',
  '🗿 스핑크스 퀴즈는 오답 통로에 들어가면 바닥이 열려 처음으로 떨어져요.',
]
