const db = require("../db/models");

const { sequelize, User, Round, Bet } = db;

const ROUND_STATE = {
  IDLE: "IDLE",
  BETTING: "BETTING",
  SPINNING: "SPINNING",
  RESULT: "RESULT",
};

const BETTING_MS = 8000;
const SPINNING_MS = 3000;
const RESULT_MS = 2000;

class RoundManager {
  constructor({ broadcast, hasPlayers }) {
    this.broadcast = broadcast;
    this.hasPlayers = hasPlayers;
    this.state = ROUND_STATE.IDLE;
    this.currentRound = null;
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 1000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (!this.hasPlayers()) return;
    if (this.state === ROUND_STATE.IDLE) {
      await this.enterBetting();
    }
  }

  async enterBetting() {
    this.state = ROUND_STATE.BETTING;
    this.currentRound = await Round.create({
      state: "BETTING",
      startedAt: new Date(),
    });
    this.broadcast({
      type: "ROUND_STATE",
      state: this.state,
      roundId: this.currentRound.id,
      bettingMs: BETTING_MS,
    });
    setTimeout(() => this.enterSpinning(), BETTING_MS);
  }

  async enterSpinning() {
    if (!this.currentRound) return this.reset();
    this.state = ROUND_STATE.SPINNING;
    await this.currentRound.update({ state: "SPINNING" });
    this.broadcast({
      type: "ROUND_STATE",
      state: this.state,
      roundId: this.currentRound.id,
      spinningMs: SPINNING_MS,
    });
    setTimeout(() => this.enterResult(), SPINNING_MS);
  }

  async enterResult() {
    if (!this.currentRound) return this.reset();
    this.state = ROUND_STATE.RESULT;
    const outcome = this.generateOutcome();
    await this.applyPayouts(outcome);
    await this.currentRound.update({
      state: "RESULT",
      result: outcome,
      finishedAt: new Date(),
    });
    this.broadcast({
      type: "ROUND_RESULT",
      roundId: this.currentRound.id,
      result: outcome,
    });
    setTimeout(() => this.reset(), RESULT_MS);
  }

  reset() {
    this.state = ROUND_STATE.IDLE;
    this.currentRound = null;
  }

  generateOutcome() {
    const symbols = ["🍒", "🔔", "7️⃣", "🍋", "⭐", "💎"];
    const reels = [0, 0, 0].map(
      () => symbols[Math.floor(Math.random() * symbols.length)]
    );
    const lineWin = reels.every((s) => s === reels[0]);
    const payoutMultiplier = lineWin ? 10 : 0;
    return { reels, lineWin, payoutMultiplier };
  }

  async applyPayouts(outcome) {
    if (!outcome) return;
    const bets = await Bet.findAll({
      where: { roundId: this.currentRound.id },
      include: [{ model: User }],
    });
    if (!bets.length) return;
    const tx = await sequelize.transaction();
    try {
      for (const bet of bets) {
        const win = bet.amount * outcome.payoutMultiplier;
        if (win > 0 && bet.User) {
          bet.User.balance += win;
          await bet.User.save({ transaction: tx });
        }
      }
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  async placeBet(userId, amount) {
    if (this.state !== ROUND_STATE.BETTING || !this.currentRound) {
      throw new Error("Betting closed");
    }
    const user = await User.findByPk(userId);
    if (!user) throw new Error("User missing");
    if (user.balance < amount) throw new Error("Insufficient balance");
    const existing = await Bet.findOne({
      where: { userId, roundId: this.currentRound.id },
    });
    if (existing) throw new Error("Bet already placed");
    const tx = await sequelize.transaction();
    try {
      user.balance -= amount;
      await user.save({ transaction: tx });
      const bet = await Bet.create(
        { userId, amount, roundId: this.currentRound.id },
        { transaction: tx }
      );
      await tx.commit();
      this.broadcast({
        type: "BET_PLACED",
        roundId: this.currentRound.id,
        user: { id: user.id, username: user.username, balance: user.balance },
        amount,
      });
      return bet;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  async currentBets() {
    if (!this.currentRound) return [];
    return Bet.findAll({ where: { roundId: this.currentRound.id } });
  }
}

module.exports = { RoundManager, ROUND_STATE };
