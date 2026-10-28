/** user.registered: users → care (стартовый набор), notifications (приветствие). */
export interface UserRegistered {
  userId: string;
  login: string;
  nickname: string;
  registeredAt: string;
}
