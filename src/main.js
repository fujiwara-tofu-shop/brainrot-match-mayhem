import './style.css'
import Phaser from 'phaser'

class MatchRevampScene extends Phaser.Scene {
  constructor() {
    super('match')
    this.cols = 6
    this.rows = 6
    this.cell = 68

    this.boardX = 0
    this.boardY = 0

    this.grid = []
    this.busy = false

    this.score = 0
    this.combo = 1
    this.timeLeft = 90

    this.drag = null

    this.emojis = ['😂', '💀', '🔥', '🧠', '🫠', '🤡', '✨', '😈']
    this.audioCtx = null
  }

  create() {
    const { width, height } = this.scale

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0b1220)
    this.add.rectangle(width / 2, height / 2, width - 14, height - 14, 0x101a2e).setStrokeStyle(2, 0x334155, 0.9)

    // Premium-ish top HUD
    this.add.rectangle(width / 2, 70, width - 20, 120, 0x111827, 0.92).setStrokeStyle(2, 0x475569, 0.9)
    this.add.text(width / 2, 28, 'EMOJI MAYHEM MATCH', {
      fontSize: '24px', color: '#f8fafc', fontStyle: '900',
    }).setOrigin(0.5)

    this.add.rectangle(98, 78, 160, 40, 0x1f2937, 0.95).setStrokeStyle(2, 0x64748b, 0.95)
    this.add.rectangle(98, 118, 160, 30, 0x3f2a12, 0.95).setStrokeStyle(2, 0xa16207, 0.9)
    this.add.rectangle(width - 82, 96, 128, 58, 0x3b1120, 0.95).setStrokeStyle(2, 0xbe185d, 0.9)

    this.scoreText = this.add.text(28, 66, 'Score: 0', { fontSize: '20px', color: '#f8fafc', fontStyle: '800' })
    this.comboText = this.add.text(28, 106, 'Combo: x1', { fontSize: '16px', color: '#fde047', fontStyle: '800' })
    this.timerText = this.add.text(width - 82, 96, `${this.timeLeft}s`, { fontSize: '24px', color: '#fb7185', fontStyle: '900' }).setOrigin(0.5)

    // Board frame
    this.boardX = Math.floor((width - this.cols * this.cell) / 2)
    this.boardY = Math.floor((height - this.rows * this.cell) / 2) + 26
    this.add.rectangle(width / 2, this.boardY + (this.rows * this.cell) / 2, this.cols * this.cell + 20, this.rows * this.cell + 20, 0x0f172a, 0.95)
      .setStrokeStyle(3, 0x38bdf8, 0.5)

    // Bottom bar
    this.add.rectangle(width / 2, height - 38, width - 20, 54, 0x111827, 0.9).setStrokeStyle(2, 0x334155, 0.9)
    this.add.text(20, height - 51, '⚡ Swipe to swap • 4=Line • 5=Bomb', { fontSize: '14px', color: '#bfdbfe', fontStyle: '700' })

    this.createStartOverlay()
  }

  createStartOverlay() {
    const { width, height } = this.scale
    this.overlay = this.add.container(width / 2, height / 2)
    const p = this.add.rectangle(0, 0, width - 44, 240, 0x020617, 0.95).setStrokeStyle(2, 0xf472b6, 0.75)
    const t1 = this.add.text(0, -62, '🧠 EMOJI BRAINROT MODE', { fontSize: '31px', color: '#f0abfc', fontStyle: '900' }).setOrigin(0.5)
    const t2 = this.add.text(0, -14, 'Smooth swipe controls. Big tiles. Big combos.', { fontSize: '18px', color: '#d1d5db' }).setOrigin(0.5)
    const t3 = this.add.text(0, 20, '4-match = line clear • 5-match = bomb', { fontSize: '16px', color: '#93c5fd', fontStyle: '700' }).setOrigin(0.5)
    const cta = this.add.text(0, 80, 'TAP TO START', { fontSize: '36px', color: '#fde047', fontStyle: '900', stroke: '#854d0e', strokeThickness: 5 }).setOrigin(0.5)
    this.tweens.add({ targets: cta, scale: 1.07, yoyo: true, repeat: -1, duration: 420 })
    this.overlay.add([p, t1, t2, t3, cta])
    this.overlay.setDepth(100)

    this.input.once('pointerdown', () => this.startGame())
  }

  startGame() {
    this.overlay.destroy()
    this.initAudio()
    this.buildInitialGrid()
    this.bindInput()

    this.clock = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.busy) return
        this.timeLeft--
        this.timerText.setText(`${this.timeLeft}s`)
        this.tweens.add({ targets: this.timerText, scale: 1.12, yoyo: true, duration: 120 })
        if (Math.random() < 0.1) this.randomJuice()
        if (this.timeLeft <= 0) this.endGame()
      },
    })
  }

  buildInitialGrid() {
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null))

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        let type = this.randType()
        let guard = 0
        while (this.wouldMatchAt(r, c, type) && guard < 20) {
          type = this.randType()
          guard++
        }
        this.grid[r][c] = this.spawnTile(r, c, type)
      }
    }
  }

  spawnTile(r, c, type) {
    const x = this.boardX + c * this.cell + this.cell / 2
    const y = this.boardY + r * this.cell + this.cell / 2

    const bg = this.add.rectangle(x, y, this.cell - 6, this.cell - 6, 0x1e293b, 0.65).setStrokeStyle(1, 0x475569, 0.9)
    const emoji = this.add.text(x, y + 1, this.emojis[type], {
      fontSize: '42px',
      fontStyle: '900',
    }).setOrigin(0.5)

    const badge = this.add.text(x + 14, y - 16, '', {
      fontSize: '20px', color: '#f8fafc', stroke: '#111827', strokeThickness: 4, fontStyle: '900',
    }).setOrigin(0.5)

    return { r, c, type, power: null, bg, emoji, badge }
  }

  bindInput() {
    this.input.on('pointerdown', (p) => {
      if (this.busy) return
      const cell = this.pickCell(p.worldX, p.worldY)
      if (!cell) return
      this.drag = { ...cell, sx: p.worldX, sy: p.worldY, used: false }
      const t = this.grid[cell.r][cell.c]
      if (t) this.setSelected(t, true)
    })

    this.input.on('pointermove', (p) => {
      if (!this.drag || this.busy || this.drag.used) return
      const dx = p.worldX - this.drag.sx
      const dy = p.worldY - this.drag.sy
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)
      if (Math.max(absX, absY) < 14) return

      let target
      if (absX > absY) target = { r: this.drag.r, c: this.drag.c + (dx > 0 ? 1 : -1) }
      else target = { r: this.drag.r + (dy > 0 ? 1 : -1), c: this.drag.c }

      if (target.r < 0 || target.r >= this.rows || target.c < 0 || target.c >= this.cols) {
        this.releaseDrag()
        return
      }

      this.drag.used = true
      this.trySwap({ r: this.drag.r, c: this.drag.c }, target)
      this.releaseDrag()
    })

    this.input.on('pointerup', () => this.releaseDrag())
    this.input.on('pointerupoutside', () => this.releaseDrag())
  }

  releaseDrag() {
    if (!this.drag) return
    const t = this.grid[this.drag.r]?.[this.drag.c]
    if (t) this.setSelected(t, false)
    this.drag = null
  }

  setSelected(tile, on) {
    tile.bg.setStrokeStyle(on ? 3 : 1, on ? 0x22d3ee : 0x475569, 0.95)
    tile.emoji.setAlpha(on ? 0.82 : 1)
  }

  pickCell(x, y) {
    const c = Math.floor((x - this.boardX) / this.cell)
    const r = Math.floor((y - this.boardY) / this.cell)
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return null
    return { r, c }
  }

  randType() {
    return Math.floor(Math.random() * this.emojis.length)
  }

  wouldMatchAt(r, c, type) {
    if (c >= 2) {
      const a = this.grid[r][c - 1]
      const b = this.grid[r][c - 2]
      if (a && b && a.type === type && b.type === type) return true
    }
    if (r >= 2) {
      const a = this.grid[r - 1][c]
      const b = this.grid[r - 2][c]
      if (a && b && a.type === type && b.type === type) return true
    }
    return false
  }

  async trySwap(a, b) {
    this.busy = true
    this.sfxSwap()

    await this.animateSwap(a, b)
    this.swapCells(a, b)

    let match = this.findMatches()
    if (!match.cells.length) {
      await this.animateSwap(a, b)
      this.swapCells(a, b)
      this.combo = 1
      this.comboText.setText('Combo: x1')
      this.busy = false
      return
    }

    await this.resolveChain(match)
    this.busy = false
  }

  animateSwap(a, b) {
    return new Promise((resolve) => {
      const A = this.grid[a.r][a.c]
      const B = this.grid[b.r][b.c]
      const ax = this.boardX + a.c * this.cell + this.cell / 2
      const ay = this.boardY + a.r * this.cell + this.cell / 2
      const bx = this.boardX + b.c * this.cell + this.cell / 2
      const by = this.boardY + b.r * this.cell + this.cell / 2

      this.tweens.add({ targets: [A.bg, A.emoji, A.badge], x: bx, y: by, duration: 95, ease: 'Sine.Out' })
      this.tweens.add({ targets: [B.bg, B.emoji, B.badge], x: ax, y: ay, duration: 95, ease: 'Sine.Out', onComplete: resolve })
    })
  }

  swapCells(a, b) {
    const t = this.grid[a.r][a.c]
    this.grid[a.r][a.c] = this.grid[b.r][b.c]
    this.grid[b.r][b.c] = t
    this.grid[a.r][a.c].r = a.r; this.grid[a.r][a.c].c = a.c
    this.grid[b.r][b.c].r = b.r; this.grid[b.r][b.c].c = b.c
  }

  findMatches() {
    const set = new Set()
    const groups = []

    // horizontal
    for (let r = 0; r < this.rows; r++) {
      let start = 0
      for (let c = 1; c <= this.cols; c++) {
        const same = c < this.cols && this.grid[r][c] && this.grid[r][c - 1] && this.grid[r][c].type === this.grid[r][c - 1].type
        if (!same) {
          const len = c - start
          if (len >= 3) {
            const cells = []
            for (let k = start; k < c; k++) {
              set.add(`${r},${k}`)
              cells.push({ r, c: k })
            }
            groups.push({ orientation: 'h', len, cells })
          }
          start = c
        }
      }
    }

    // vertical
    for (let c = 0; c < this.cols; c++) {
      let start = 0
      for (let r = 1; r <= this.rows; r++) {
        const same = r < this.rows && this.grid[r][c] && this.grid[r - 1][c] && this.grid[r][c].type === this.grid[r - 1][c].type
        if (!same) {
          const len = r - start
          if (len >= 3) {
            const cells = []
            for (let k = start; k < r; k++) {
              set.add(`${k},${c}`)
              cells.push({ r: k, c })
            }
            groups.push({ orientation: 'v', len, cells })
          }
          start = r
        }
      }
    }

    const cells = Array.from(set).map((s) => {
      const [r, c] = s.split(',').map(Number)
      return { r, c }
    })

    return { cells, groups }
  }

  choosePowerups(groups) {
    const out = []
    for (const g of groups) {
      if (g.len < 4) continue
      const pivot = Phaser.Utils.Array.GetRandom(g.cells)
      const power = g.len >= 5 ? 'bomb' : (g.orientation === 'h' ? 'row' : 'col')
      out.push({ ...pivot, power })
    }
    return out
  }

  async resolveChain(match) {
    let current = match
    let chain = 0

    while (current.cells.length && chain < 25) {
      chain++
      this.combo++
      this.comboText.setText(`Combo: x${this.combo}`)
      this.sfxCombo(this.combo)

      const powerSpawns = this.choosePowerups(current.groups)
      const spawnMap = new Map(powerSpawns.map((p) => [`${p.r},${p.c}`, p.power]))

      let blast = current.cells.filter(({ r, c }) => !spawnMap.has(`${r},${c}`))

      // Trigger existing powers in blast set
      const expanded = new Set(blast.map(({ r, c }) => `${r},${c}`))
      for (const { r, c } of blast) {
        const t = this.grid[r][c]
        if (t?.power) this.expandPower(t, expanded)
      }
      blast = Array.from(expanded).map((s) => {
        const [r, c] = s.split(',').map(Number)
        return { r, c }
      })

      // Promote spawns to power tiles
      for (const s of powerSpawns) {
        const t = this.grid[s.r][s.c]
        if (!t) continue
        t.power = s.power
        t.badge.setText(s.power === 'row' ? '↔' : s.power === 'col' ? '↕' : '💥')
        this.tweens.add({ targets: [t.emoji, t.badge], scale: 1.14, yoyo: true, duration: 120 })
        this.sfxPower()
      }

      this.addScore(blast.length * 90 * this.combo)
      this.sfxMatch(blast.length)
      await this.blastTiles(blast)

      this.applyGravity()
      await this.animateGravity()
      this.fillNew()
      await this.animateFill()

      if (Math.random() < 0.12) this.randomJuice(true)

      current = this.findMatches()
    }

    this.combo = 1
    this.comboText.setText('Combo: x1')
  }

  expandPower(tile, out) {
    if (tile.power === 'row') {
      for (let c = 0; c < this.cols; c++) out.add(`${tile.r},${c}`)
      this.pop('ROW BLAST')
    } else if (tile.power === 'col') {
      for (let r = 0; r < this.rows; r++) out.add(`${r},${tile.c}`)
      this.pop('COLUMN BLAST')
    } else if (tile.power === 'bomb') {
      for (let r = tile.r - 1; r <= tile.r + 1; r++) {
        for (let c = tile.c - 1; c <= tile.c + 1; c++) {
          if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) out.add(`${r},${c}`)
        }
      }
      this.pop('EMOJI BOMB')
      this.sfxBoom()
    }
  }

  blastTiles(cells) {
    return new Promise((resolve) => {
      if (!cells.length) return resolve()
      this.cameras.main.shake(130, 0.006)
      let done = 0

      for (const { r, c } of cells) {
        const t = this.grid[r][c]
        if (!t) { done++; if (done === cells.length) resolve(); continue }

        for (let i = 0; i < 6; i++) {
          const p = this.add.circle(t.emoji.x, t.emoji.y, Phaser.Math.Between(2, 5), Phaser.Display.Color.RandomRGB().color)
          const a = Math.random() * Math.PI * 2
          const d = Phaser.Math.Between(16, 44)
          this.tweens.add({
            targets: p,
            x: p.x + Math.cos(a) * d,
            y: p.y + Math.sin(a) * d,
            alpha: 0,
            duration: 220,
            onComplete: () => p.destroy(),
          })
        }

        this.tweens.add({
          targets: [t.bg, t.emoji, t.badge],
          scale: 0,
          alpha: 0,
          duration: 150,
          onComplete: () => {
            t.bg.destroy(); t.emoji.destroy(); t.badge.destroy()
            this.grid[r][c] = null
            done++
            if (done === cells.length) resolve()
          },
        })
      }
    })
  }

  applyGravity() {
    for (let c = 0; c < this.cols; c++) {
      let write = this.rows - 1
      for (let r = this.rows - 1; r >= 0; r--) {
        if (this.grid[r][c]) {
          if (write !== r) {
            this.grid[write][c] = this.grid[r][c]
            this.grid[write][c].r = write
            this.grid[r][c] = null
          }
          write--
        }
      }
    }
  }

  animateGravity() {
    return new Promise((resolve) => {
      const jobs = []
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const t = this.grid[r][c]
          if (!t) continue
          const x = this.boardX + c * this.cell + this.cell / 2
          const y = this.boardY + r * this.cell + this.cell / 2
          if (Math.abs(t.emoji.y - y) > 1 || Math.abs(t.emoji.x - x) > 1) {
            jobs.push(new Promise((done) => {
              this.tweens.add({ targets: [t.bg, t.emoji, t.badge], x, y, duration: 160, ease: 'Quad.Out', onComplete: done })
            }))
          }
        }
      }
      Promise.all(jobs).then(resolve)
      if (!jobs.length) resolve()
    })
  }

  fillNew() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.grid[r][c]) {
          const t = this.spawnTile(r, c, this.randType())
          t.emoji.y -= Phaser.Math.Between(80, 190)
          t.badge.y = t.emoji.y
          this.grid[r][c] = t
        }
      }
    }
  }

  animateFill() {
    return new Promise((resolve) => {
      const jobs = []
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const t = this.grid[r][c]
          const x = this.boardX + c * this.cell + this.cell / 2
          const y = this.boardY + r * this.cell + this.cell / 2
          if (Math.abs(t.emoji.y - y) > 1) {
            jobs.push(new Promise((done) => {
              this.tweens.add({ targets: [t.emoji, t.badge], x, y, duration: 190, ease: 'Back.Out', onComplete: done })
            }))
          }
        }
      }
      Promise.all(jobs).then(resolve)
      if (!jobs.length) resolve()
    })
  }

  randomJuice(inCascade = false) {
    if (Math.random() < 0.5) {
      this.cameras.main.shake(220, 0.008)
      this.pop('CHAOS SHAKE')
      this.addScore(inCascade ? 350 : 180)
      this.sfxPower()
    } else {
      const r = Phaser.Math.Between(0, this.rows - 1)
      const c = Phaser.Math.Between(0, this.cols - 1)
      const t = this.grid[r][c]
      if (!t) return
      t.type = this.randType()
      t.emoji.setText(this.emojis[t.type])
      t.power = Math.random() < 0.2 ? Phaser.Utils.Array.GetRandom(['row', 'col', 'bomb']) : null
      t.badge.setText(t.power === 'row' ? '↔' : t.power === 'col' ? '↕' : t.power === 'bomb' ? '💥' : '')
      this.tweens.add({ targets: [t.emoji, t.badge], angle: 360, duration: 220, onComplete: () => { t.emoji.angle = 0; t.badge.angle = 0 } })
      this.pop('MUTATION')
    }
  }

  addScore(v) {
    this.score += v
    this.scoreText.setText(`Score: ${this.score.toLocaleString()}`)
    if (v > 700) this.pop(`MEGA +${v}`)
  }

  pop(text) {
    const { width } = this.scale
    const t = this.add.text(width / 2, 156, text, {
      fontSize: '34px', color: '#fef08a', fontStyle: '900', stroke: '#7c2d12', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(90)
    this.tweens.add({ targets: t, y: t.y - 38, alpha: 0, duration: 560, onComplete: () => t.destroy() })
  }

  endGame() {
    this.busy = true
    this.clock?.remove(false)
    this.input.removeAllListeners()
    this.sfxBoom()
    this.cameras.main.shake(700, 0.02)

    const { width, height } = this.scale
    const o = this.add.container(width / 2, height / 2)
    const p = this.add.rectangle(0, 0, width - 46, 250, 0x020617, 0.95).setStrokeStyle(3, 0x22d3ee, 0.85)
    const t1 = this.add.text(0, -60, 'ROUND OVER', { fontSize: '36px', color: '#f8fafc', fontStyle: '900' }).setOrigin(0.5)
    const t2 = this.add.text(0, -6, `Final Score: ${this.score.toLocaleString()}`, { fontSize: '30px', color: '#fde047', fontStyle: '900' }).setOrigin(0.5)
    const t3 = this.add.text(0, 42, 'Tap to replay', { fontSize: '18px', color: '#93c5fd' }).setOrigin(0.5)
    o.add([p, t1, t2, t3])
    o.setDepth(110)

    this.input.once('pointerdown', () => this.scene.restart())
  }

  initAudio() {
    if (this.audioCtx) return
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    this.audioCtx = new Ctx()
  }

  beep({ freq = 440, duration = 0.08, type = 'sine', gain = 0.06, slide = 0 } = {}) {
    if (!this.audioCtx) return
    const now = this.audioCtx.currentTime
    const o = this.audioCtx.createOscillator()
    const g = this.audioCtx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, now)
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(70, freq + slide), now + duration)
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(gain, now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    o.connect(g); g.connect(this.audioCtx.destination)
    o.start(now); o.stop(now + duration + 0.02)
  }

  sfxSwap() { this.beep({ freq: 280, duration: 0.06, type: 'square', gain: 0.04, slide: 90 }) }
  sfxMatch(n = 3) {
    const b = 380 + n * 16
    this.beep({ freq: b, duration: 0.08, type: 'triangle', gain: 0.06, slide: 120 })
    setTimeout(() => this.beep({ freq: b * 1.2, duration: 0.1, type: 'sawtooth', gain: 0.045, slide: 140 }), 36)
  }
  sfxCombo(level) { this.beep({ freq: 520 + level * 15, duration: 0.1, type: 'square', gain: 0.06, slide: 200 }) }
  sfxPower() { this.beep({ freq: 210, duration: 0.16, type: 'sawtooth', gain: 0.08, slide: 800 }) }
  sfxBoom() { this.beep({ freq: 120, duration: 0.2, type: 'sawtooth', gain: 0.1, slide: -70 }) }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0b1220',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 480,
    height: 860,
  },
  physics: { default: 'arcade' },
  scene: [MatchRevampScene],
})
