export interface Question {
  id: string
  question: string
  answers: string[]
  correctAnswer: number
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  explanation?: string
}

export interface RankingQuestion {
  id: string
  title: string
  description: string
  correctOrder: RankingItem[]
  category: string
  season?: string
  hints: boolean
  maxAttempts?: number
}

export interface RankingItem {
  id: string
  name: string
  position: number
  nationality?: string
  club?: string
  value?: string
  hints?: {
    letterCount: number
    firstLetter?: string
    lastLetter?: string
    founded?: string
    stadium?: string
    nickname?: string
    titles?: string
    historicalFact?: string
    city?: string
    region?: string
  }
}

export interface RankingUserAnswer {
  position: number
  userInput: string
  isCorrect: boolean
  attempts: number
  revealed: boolean
}

export interface QuizSession {
  id: string
  type: 'classic' | 'ranking'
  questions: Question[] | RankingQuestion[]
  currentQuestionIndex: number
  score: number
  startTime: Date
  endTime?: Date
  answers: UserAnswer[]
}

export interface UserAnswer {
  questionId: string
  answer: number | string[]
  isCorrect: boolean
  timeSpent: number
}

export interface UserProfile {
  id: string
  username: string
  avatar?: string
  stats: UserStats
  preferences: UserPreferences
}

export interface UserStats {
  totalQuizzes: number
  totalQuestions: number
  correctAnswers: number
  averageScore: number
  bestScore: number
  currentStreak: number
  bestStreak: number
  categoryStats: Record<string, CategoryStats>
}

export interface CategoryStats {
  played: number
  correct: number
  averageScore: number
}

export interface UserPreferences {
  theme: 'light' | 'dark'
  soundEnabled: boolean
  timeLimit: boolean
  notifications: boolean
}
