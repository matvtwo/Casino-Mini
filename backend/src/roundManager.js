const db = require("../db/models");

const { sequelize, User, Round, Bet, Transaction } = db;

const ROUND_STATE = {
  IDLE: "IDLE",
  BETTING: "BETTING",
  SPINNING: "SPINNING",
  RESULT: "RESULT",
};

const BETTING_MS = 8000;
const SPINNING_MS = 3000;
const RESULT_MS = 2000;

const PAY_SYMBOLS = [
  { key: "diamond", icon: "💎", weight: 1, multiplier: 25 },
  { key: "seven", icon: "7️⃣", weight: 2, multiplier: 15 },
  { key: "bell", icon: "🔔", weight: 3, multiplier: 12 },
  { key: "cherry", icon: "🍒", weight: 4, multiplier: 10 },
  { key: "lemon", icon: "🍋", weight: 5, multiplier: 6 },
  { key: "clover", icon: "☘️", weight: 6, multiplier: 5 },
];

const FORCE_WIN_CHANCE = 0.35; // higher than default to raise win frequency
const symbolByIcon = PAY_SYMBOLS.reduce((acc, symbol) => {
  acc[symbol.icon] = symbol;
  return acc;
}, {});

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  const roll = Math.random() * total;
  let cursor = 0;
  for (const item of items) {
    cursor += item.weight;
    if (roll <= cursor) return item;
  }
  return items[items.length - 1];
}

class RoundManager {
  constructor({ broadcast, hasPlayers, onBalanceChange = () => {} }) {
    this.broadcast = broadcast;
    this.hasPlayers = hasPlayers;
    this.onBalanceChange = onBalanceChange;
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
    const forceWin = Math.random() < FORCE_WIN_CHANCE;
    if (forceWin) {
      const symbol = weightedPick(PAY_SYMBOLS);
      return {
        reels: [symbol.icon, symbol.icon, symbol.icon],
        lineWin: true,
        winningSymbol: symbol.key,
        payoutMultiplier: symbol.multiplier,
      };
    }

    const reels = [0, 0, 0].map(() => weightedPick(PAY_SYMBOLS).icon);
    const lineWin = reels.every((s) => s === reels[0]);
    const winningSymbol = lineWin ? symbolByIcon[reels[0]]?.key : null;
    const payoutMultiplier = lineWin
      ? symbolByIcon[reels[0]]?.multiplier || 0
      : 0;

    return { reels, lineWin, winningSymbol, payoutMultiplier };
  }

  async applyPayouts(outcome) {
    if (!outcome) return;
    const bets = await Bet.findAll({
      where: { roundId: this.currentRound.id },
      include: [{ model: User }],
    });
    if (!bets.length) return;
    const tx = await sequelize.transaction();
    const winners = [];
    try {
      for (const bet of bets) {
        const win = bet.amount * (outcome.payoutMultiplier || 0);
        if (win > 0 && bet.User) {
          bet.payout = win;
          await bet.save({ transaction: tx });
          bet.User.balance += win;
          await bet.User.save({ transaction: tx });
          await Transaction.create(
            {
              type: "PAYOUT",
              amount: win,
              description: `Win x${outcome.payoutMultiplier} on ${outcome.winningSymbol || "line"}`,
              userId: bet.User.id,
              actorId: bet.User.id,
            },
            { transaction: tx }
          );
          winners.push({ user: bet.User, win });
        }
      }
      await tx.commit();
      winners.forEach(({ user, win }) => {
        this.onBalanceChange(user);
        this.broadcast({
          type: "PAYOUT",
          roundId: this.currentRound.id,
          user: {
            id: user.id,
            username: user.username,
            balance: user.balance,
          },
          amount: win,
          multiplier: outcome.payoutMultiplier,
          symbol: outcome.winningSymbol,
        });
      });
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
    if (amount <= 0) throw new Error("Invalid bet amount");
    if (user.balance < amount) throw new Error("Insufficient balance");
    const existing = await Bet.findOne({
      where: { userId, roundId: this.currentRound.id },
    });
    if (existing) throw new Error("Bet already placed");
    const tx = await sequelize.transaction();
    try {
      user.balance -= amount;
      await user.save({ transaction: tx });
      await Transaction.create(
        {
          type: "BET",
          amount: -amount,
          description: "Slot bet placed",
          userId: user.id,
          actorId: user.id,
        },
        { transaction: tx }
      );
      const bet = await Bet.create(
        { userId, amount, roundId: this.currentRound.id },
        { transaction: tx }
      );
      await tx.commit();
      this.onBalanceChange(user);
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

module.exports = { RoundManager, ROUND_STATE, PAY_SYMBOLS };
