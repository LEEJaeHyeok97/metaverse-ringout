/**
 * 링아웃 스핑크스의 넌센스 퀴즈. answer는 options에서 정답의 번호다.
 * 화면에 낼 때 보기 순서를 섞어서, 통로마다 정답 자리가 매번 다르다.
 */
export type Quiz = { question: string; options: [string, string, string]; answer: 0 | 1 | 2 }

export const QUIZZES: readonly Quiz[] = [
  { question: '알람이 가장 싫어하는 말은?', options: ['5분만 더', '굿모닝', '벌써 일어났어'], answer: 0 },
  { question: '링아웃 알람을 완전히 끄는 방법은?', options: ['폰을 던진다', '목표 지점에 도착한다', '다시 잔다'], answer: 1 },
  { question: '세상에서 가장 뜨거운 과일은?', options: ['수박', '귤', '천도복숭아'], answer: 2 },
  { question: '왕이 넘어지면?', options: ['킹콩', '킹크랩', '왕창'], answer: 0 },
  { question: '소가 웃는 소리는?', options: ['음매', '우하하', '소소소'], answer: 1 },
  { question: '아몬드가 죽으면?', options: ['땅콩', '아몬드빵', '다이아몬드'], answer: 2 },
  { question: '발이 두 개 달린 소는?', options: ['이발소', '젖소', '황소'], answer: 0 },
  { question: '개 중에 가장 아름다운 개는?', options: ['진돗개', '무지개', '안개'], answer: 1 },
  { question: '오리가 얼면?', options: ['오리발', '얼음오리', '언덕'], answer: 2 },
  { question: '딸기가 회사에서 잘리면?', options: ['딸기시럽', '딸기잼', '딸기우유'], answer: 0 },
  { question: '세상에서 가장 쉬운 숫자는?', options: ['1', '190000', '0'], answer: 1 },
  { question: '바다가 화나면?', options: ['파도', '해일', '물불'], answer: 0 },
  { question: '자동차를 톡 치면?', options: ['카톡', '빵빵', '쿵'], answer: 0 },
  { question: '미소의 반대말은?', options: ['울음', '당기소', '찡그림'], answer: 1 },
  { question: '아침에 일어나자마자 하면 좋은 앱은?', options: ['게임', '쇼핑', '링아웃'], answer: 2 },
  { question: '가장 무서운 비는?', options: ['장대비', '소나기', '사라비'], answer: 2 },
  { question: '먹으면 죽는 음식은?', options: ['죽', '밥', '빵'], answer: 0 },
  { question: '신발이 화나면?', options: ['운동화', '신발끈', '슬리퍼'], answer: 1 },
]

/** 보기 순서를 섞은 문제. correct는 섞은 뒤 정답이 있는 통로 번호(왼쪽 0, 가운데 1, 오른쪽 2)다. */
export type ShownQuiz = { question: string; options: string[]; correct: number }

export function pickQuiz(previous?: string, random = Math.random): ShownQuiz {
  const pool = QUIZZES.filter((quiz) => quiz.question !== previous)
  const quiz = pool[Math.floor(random() * pool.length)]
  const order = [0, 1, 2].sort(() => random() - 0.5)
  return { question: quiz.question, options: order.map((index) => quiz.options[index]), correct: order.indexOf(quiz.answer) }
}
