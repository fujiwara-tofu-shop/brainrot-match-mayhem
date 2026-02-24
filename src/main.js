import './style.css'
import Phaser from 'phaser'

class BrainrotMatchScene extends Phaser.Scene {
  constructor() {
    super('brainrot')
    this.cols = 8
    this.rows = 8
    this.cell = 52
    this.offsetX = 0
    this.offsetY = 0
    this.tiles = []
    this.selected = null
    this.busy = false
    this.score = 0
    this.combo = 1
    this.timeLeft = 75
    this.gameStarted = false
    this.memeDefs = []
    this.audioCtx = null
  }

  preload() {
    this.load.json('manifest', `${import.meta.env.BASE_URL}memes/manifest.json`)
  }

  create() {
    const { width, height } = this.scale

    this.bg = this.add.rectangle(width / 2, height / 2, width, height, 0x120b1f)
    this.add.rectangle(width / 2, height / 2, width - 18, height - 18, 0x1f1238, 1).setStrokeStyle(2, 0x9333ea, 0.4)

    // Top HUD (mobile polished)
    this.add.rectangle(width / 2, 62, width - 20, 106, 0x111827, 0.82).setStrokeStyle(2, 0x334155, 0.95)
    this.title = this.add.text(width / 2, 28, 'BRAINROT MATCH MAYHEM', {
      fontFamily: 'Inter, system-ui', fontSize: '22px', color: '#f8fafc', fontStyle: '900',
    }).setOrigin(0.5)

    this.scoreChip = this.add.rectangle(108, 78, 168, 38, 0x1f2937, 0.95).setStrokeStyle(2, 0x475569, 0.9)
    this.comboChip = this.add.rectangle(108, 116, 168, 30, 0x3f2a12, 0.95).setStrokeStyle(2, 0xa16207, 0.9)
    this.timerChip = this.add.rectangle(width - 78, 96, 120, 56, 0x2b1220, 0.95).setStrokeStyle(2, 0xbe185d, 0.9)

    this.scoreText = this.add.text(28, 67, 'Score: 0', { fontSize: '20px', color: '#f8fafc', fontStyle: '800' })
    this.comboText = this.add.text(28, 106, 'Combo: x1', { fontSize: '16px', color: '#fde047', fontStyle: '800' })
    this.timerText = this.add.text(width - 78, 96, `${this.timeLeft}s`, { fontSize: '24px', color: '#fb7185', fontStyle: '900' }).setOrigin(0.5)

    this.boardBack = this.add.rectangle(width / 2, height / 2 + 24, this.cols * this.cell + 18, this.rows * this.cell + 18, 0x0f172a, 0.92)
      .setStrokeStyle(3, 0x60a5fa, 0.45)

    // Bottom action bar visual polish
    this.add.rectangle(width / 2, height - 38, width - 20, 54, 0x111827, 0.86).setStrokeStyle(2, 0x334155, 0.9)
    this.add.text(28, height - 49, '⚡ POWERUPS', { fontSize: '15px', color: '#93c5fd', fontStyle: '800' })
    this.add.text(width - 24, height - 49, '💥 CHAOS ON', { fontSize: '15px', color: '#fda4af', fontStyle: '800' }).setOrigin(1, 0)

    this.offsetX = Math.floor((width - this.cols * this.cell) / 2)
    this.offsetY = Math.floor(height / 2 + 28 - (this.rows * this.cell) / 2)

    this.overlay = this.add.container(width / 2, height / 2)
    const panel = this.add.rectangle(0, 0, width - 40, 250, 0x020617, 0.94).setStrokeStyle(2, 0xf472b6, 0.7)
    const t1 = this.add.text(0, -70, '💀 MEME CASCADE MODE 💀', { fontSize: '30px', color: '#f0abfc', fontStyle: '900' }).setOrigin(0.5)
    const t2 = this.add.text(0, -14, 'Match meme tiles. Trigger cursed powerups.', { fontSize: '18px', color: '#d1d5db' }).setOrigin(0.5)
    const t3 = this.add.text(0, 18, '4-match = ROW/COL MEME BLAST • 5-match = BOMB', { fontSize: '15px', color: '#93c5fd', fontStyle: '700' }).setOrigin(0.5)
    const cta = this.add.text(0, 82, 'TAP TO START', { fontSize: '36px', color: '#fde047', fontStyle: '900', stroke: '#854d0e', strokeThickness: 5 }).setOrigin(0.5)
    this.tweens.add({ targets: cta, scale: 1.08, yoyo: true, repeat: -1, duration: 460 })
    this.overlay.add([panel, t1, t2, t3, cta])
    this.overlay.setDepth(100)

    this.input.once('pointerdown', () => this.startGame())
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
    const osc = this.audioCtx.createOscillator()
    const g = this.audioCtx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(70, freq + slide), now + duration)
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(gain, now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(g)
    g.connect(this.audioCtx.destination)
    osc.start(now)
    osc.stop(now + duration + 0.02)
  }

  sfxSwap() {
    this.beep({ freq: 260, duration: 0.06, type: 'square', gain: 0.04, slide: 110 })
  }

  sfxMatch(count = 3) {
    const base = 380 + count * 20
    this.beep({ freq: base, duration: 0.08, type: 'triangle', gain: 0.06, slide: 120 })
    setTimeout(() => this.beep({ freq: base * 1.2, duration: 0.1, type: 'sawtooth', gain: 0.05, slide: 160 }), 40)
  }

  sfxPower() {
    this.beep({ freq: 200, duration: 0.16, type: 'sawtooth', gain: 0.08, slide: 900 })
  }

  sfxCombo(level) {
    this.beep({ freq: 520 + level * 18, duration: 0.1, type: 'square', gain: 0.06, slide: 220 })
  }

  sfxBoom() {
    this.beep({ freq: 120, duration: 0.2, type: 'sawtooth', gain: 0.1, slide: -70 })
  }

  startGame() {
    if (this.gameStarted) return
    this.gameStarted = true
    this.overlay.destroy()
    this.initAudio()

    const manifest = this.cache.json.get('manifest') || []
    this.memeDefs = manifest.slice(0, 12)

    this.memeDefs.forEach((m, i) => {
      const rel = String(m.file || '').replace(/^\/+/, '')
      this.load.image(`meme_${i}`, `${import.meta.env.BASE_URL}${rel}`)
    })

    this.load.once('complete', () => {
      this.initBoard()
      this.startClock()
      this.enableInput()
    })
    this.load.start()
  }

  initBoard() {
    this.tiles = []
    for (let r = 0; r < this.rows; r++) {
      this.tiles[r] = []
      for (let c = 0; c < this.cols; c++) {
        let type = this.randType()
        let guard = 0
        while (this.wouldMakeStartMatch(r, c, type) && guard < 20) {
          type = this.randType()
          guard++
        }
        this.tiles[r][c] = this.spawnTile(c, r, type, true)
      }
    }
  }

  wouldMakeStartMatch(r, c, type) {
    if (c >= 2) {
      const a = this.tiles[r][c - 1]
      const b = this.tiles[r][c - 2]
      if (a && b && a.type === type && b.type === type) return true
    }
    if (r >= 2) {
      const a = this.tiles[r - 1]?.[c]
      const b = this.tiles[r - 2]?.[c]
      if (a && b && a.type === type && b.type === type) return true
    }
    return false
  }

  startClock() {
    this.timeEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.busy) return
        this.timeLeft -= 1
        this.timerText.setText(`${this.timeLeft}s`)
        this.timerText.setScale(1.15)
        this.tweens.add({ targets: this.timerText, scale: 1, duration: 150 })

        if (Math.random() < 0.13) this.randomChaosEvent()

        if (this.timeLeft <= 0) this.endGame()
      },
    })
  }

  endGame() {
    this.busy = true
    this.input.removeAllListeners()
    this.timeEvent?.remove(false)
    this.sfxBoom()
    this.cameras.main.shake(700, 0.02)

    const { width, height } = this.scale
    const over = this.add.container(width / 2, height / 2)
    const panel = this.add.rectangle(0, 0, width - 46, 250, 0x020617, 0.95).setStrokeStyle(3, 0x22d3ee, 0.85)
    const t1 = this.add.text(0, -62, 'ROUND OVER', { fontSize: '36px', color: '#f8fafc', fontStyle: '900' }).setOrigin(0.5)
    const t2 = this.add.text(0, -10, `Final Score: ${this.score.toLocaleString()}`, { fontSize: '31px', color: '#fde047', fontStyle: '900' }).setOrigin(0.5)
    const t3 = this.add.text(0, 38, 'Tap to replay the cursed run.', { fontSize: '18px', color: '#93c5fd' }).setOrigin(0.5)
    const t4 = this.add.text(0, 80, '⚠️ Certified mobile brainrot', { fontSize: '16px', color: '#f0abfc' }).setOrigin(0.5)
    over.add([panel, t1, t2, t3, t4])
    over.setDepth(120)

    this.input.once('pointerdown', () => this.scene.restart())
  }

  enableInput() {
    this.input.on('pointerdown', (p) => {
      if (this.busy) return
      const picked = this.pickTile(p.worldX, p.worldY)
      if (!picked) return

      const { r, c } = picked
      const tile = this.tiles[r][c]
      if (!tile) return

      if (!this.selected) {
        this.selected = { r, c }
        this.highlight(tile, true)
        return
      }

      const first = this.selected
      if (first.r === r && first.c === c) {
        this.highlight(tile, false)
        this.selected = null
        return
      }

      const firstTile = this.tiles[first.r][first.c]
      if (!this.isAdjacent(first, { r, c })) {
        this.highlight(firstTile, false)
        this.selected = { r, c }
        this.highlight(tile, true)
        return
      }

      this.highlight(firstTile, false)
      this.selected = null
      this.trySwap(first, { r, c })
    })
  }

  pickTile(x, y) {
    const c = Math.floor((x - this.offsetX) / this.cell)
    const r = Math.floor((y - this.offsetY) / this.cell)
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return null
    return { r, c }
  }

  isAdjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1
  }

  highlight(tile, on) {
    tile.bg.setStrokeStyle(on ? 4 : 0, on ? 0x22d3ee : 0, on ? 1 : 0)
    // keep tile size stable on mobile; pulse alpha only
    this.tweens.add({ targets: tile.sprite, alpha: on ? 0.85 : 1.0, duration: 90 })
  }

  tilePowerText(power) {
    if (power === 'row') return '↔'
    if (power === 'col') return '↕'
    if (power === 'bomb') return '💥'
    return ''
  }

  spawnTile(c, r, type, instant = false, power = null) {
    const x = this.offsetX + c * this.cell + this.cell / 2
    const y = this.offsetY + r * this.cell + this.cell / 2

    const bg = this.add.rectangle(x, y, this.cell - 6, this.cell - 6, 0x1e293b, 0.45).setOrigin(0.5)
    const sprite = this.add.image(x, instant ? y : y - 420, `meme_${type}`).setDisplaySize(this.cell - 10, this.cell - 10).setOrigin(0.5)
    const badge = this.add.text(x + 12, y - 16, this.tilePowerText(power), {
      fontSize: '20px', color: '#f8fafc', stroke: '#111827', strokeThickness: 4, fontStyle: '900',
    }).setOrigin(0.5)
    badge.setDepth(10)

    if (!instant) this.tweens.add({ targets: sprite, y, duration: 260, ease: 'Back.Out' })

    return { r, c, type, power, bg, sprite, badge }
  }

  randType() {
    return Math.floor(Math.random() * this.memeDefs.length)
  }

  async trySwap(a, b) {
    this.busy = true
    this.sfxSwap()
    await this.animateSwap(a, b)
    this.swapGrid(a, b)

    let matches = this.findMatches()
    if (!matches.cells.length) {
      await this.animateSwap(a, b)
      this.swapGrid(a, b)
      this.combo = 1
      this.comboText.setText('Combo: x1')
      this.busy = false
      return
    }

    await this.resolveMatchesLoop(matches)
    this.busy = false
  }

  animateSwap(a, b) {
    return new Promise((resolve) => {
      const tA = this.tiles[a.r][a.c]
      const tB = this.tiles[b.r][b.c]
      const ax = this.offsetX + a.c * this.cell + this.cell / 2
      const ay = this.offsetY + a.r * this.cell + this.cell / 2
      const bx = this.offsetX + b.c * this.cell + this.cell / 2
      const by = this.offsetY + b.r * this.cell + this.cell / 2
      this.tweens.add({ targets: [tA.sprite, tA.bg, tA.badge], x: bx, y: by, duration: 120, ease: 'Sine.Out' })
      this.tweens.add({ targets: [tB.sprite, tB.bg, tB.badge], x: ax, y: ay, duration: 120, ease: 'Sine.Out', onComplete: resolve })
    })
  }

  swapGrid(a, b) {
    const tmp = this.tiles[a.r][a.c]
    this.tiles[a.r][a.c] = this.tiles[b.r][b.c]
    this.tiles[b.r][b.c] = tmp
    this.tiles[a.r][a.c].r = a.r; this.tiles[a.r][a.c].c = a.c
    this.tiles[b.r][b.c].r = b.r; this.tiles[b.r][b.c].c = b.c
  }

  findMatches() {
    const cellSet = new Set()
    const groups = []

    // horizontal groups
    for (let r = 0; r < this.rows; r++) {
      let runStart = 0
      for (let c = 1; c <= this.cols; c++) {
        const same = c < this.cols && this.tiles[r][c] && this.tiles[r][c - 1] && this.tiles[r][c].type === this.tiles[r][c - 1].type
        if (!same) {
          const len = c - runStart
          if (len >= 3) {
            const cells = []
            for (let k = runStart; k < c; k++) {
              cellSet.add(`${r},${k}`)
              cells.push({ r, c: k })
            }
            groups.push({ orientation: 'h', len, cells })
          }
          runStart = c
        }
      }
    }

    // vertical groups
    for (let c = 0; c < this.cols; c++) {
      let runStart = 0
      for (let r = 1; r <= this.rows; r++) {
        const same = r < this.rows && this.tiles[r][c] && this.tiles[r - 1][c] && this.tiles[r][c].type === this.tiles[r - 1][c].type
        if (!same) {
          const len = r - runStart
          if (len >= 3) {
            const cells = []
            for (let k = runStart; k < r; k++) {
              cellSet.add(`${k},${c}`)
              cells.push({ r: k, c })
            }
            groups.push({ orientation: 'v', len, cells })
          }
          runStart = r
        }
      }
    }

    const cells = Array.from(cellSet).map((s) => {
      const [r, c] = s.split(',').map(Number)
      return { r, c }
    })

    return { cells, groups }
  }

  choosePowerupSpawns(groups) {
    const spawns = []
    for (const g of groups) {
      if (g.len < 4) continue
      const pivot = Phaser.Utils.Array.GetRandom(g.cells)
      const power = g.len >= 5 ? 'bomb' : (g.orientation === 'h' ? 'row' : 'col')
      spawns.push({ ...pivot, power })
    }
    return spawns
  }

  async resolveMatchesLoop(matchObj) {
    let current = matchObj
    let chainGuard = 0

    while (current.cells.length && chainGuard < 30) {
      chainGuard++
      this.combo += 1
      this.comboText.setText(`Combo: x${this.combo}`)
      this.sfxCombo(this.combo)

      const spawns = this.choosePowerupSpawns(current.groups)
      const spawnMap = new Map(spawns.map((s) => [`${s.r},${s.c}`, s.power]))

      // cells to remove (excluding spawn cells)
      let blastCells = current.cells.filter(({ r, c }) => !spawnMap.has(`${r},${c}`))

      // trigger existing power tiles that are being removed
      const expanded = new Set(blastCells.map(({ r, c }) => `${r},${c}`))
      for (const { r, c } of blastCells) {
        const t = this.tiles[r][c]
        if (!t?.power) continue
        this.expandPowerTargets(t, expanded)
      }
      blastCells = Array.from(expanded).map((s) => {
        const [r, c] = s.split(',').map(Number)
        return { r, c }
      })

      // convert spawn tiles into powerups (don't delete)
      for (const s of spawns) {
        const t = this.tiles[s.r][s.c]
        if (!t) continue
        t.power = s.power
        t.badge.setText(this.tilePowerText(s.power))
        this.tweens.add({ targets: [t.sprite, t.badge], scale: 1.18, yoyo: true, duration: 150 })
        this.sfxPower()
      }

      const scoreGain = blastCells.length * 85 * this.combo
      this.addScore(scoreGain)
      this.sfxMatch(blastCells.length)

      await this.blast(blastCells)
      this.applyGravity()
      await this.animateGravity()
      this.fillEmpty()
      await this.animateFill()

      if (Math.random() < 0.22) this.randomChaosEvent(true)

      current = this.findMatches()
    }

    this.combo = 1
    this.comboText.setText('Combo: x1')
  }

  expandPowerTargets(tile, set) {
    const { r, c, power } = tile
    if (power === 'row') {
      for (let x = 0; x < this.cols; x++) set.add(`${r},${x}`)
      this.cameras.main.shake(180, 0.01)
      this.popText('ROW WIPE')
    } else if (power === 'col') {
      for (let y = 0; y < this.rows; y++) set.add(`${y},${c}`)
      this.cameras.main.shake(180, 0.01)
      this.popText('COLUMN NUKE')
    } else if (power === 'bomb') {
      for (let y = r - 1; y <= r + 1; y++) {
        for (let x = c - 1; x <= c + 1; x++) {
          if (y >= 0 && y < this.rows && x >= 0 && x < this.cols) set.add(`${y},${x}`)
        }
      }
      this.cameras.main.shake(250, 0.014)
      this.popText('MEME BOMB')
      this.sfxBoom()
    }
  }

  addScore(v) {
    this.score += v
    this.scoreText.setText(`Score: ${this.score.toLocaleString()}`)
    if (v > 700) this.popText(`MEGA +${v}`)
  }

  popText(text) {
    const { width } = this.scale
    const t = this.add.text(width / 2, 155, text, {
      fontSize: '34px', color: '#fef08a', fontStyle: '900', stroke: '#7c2d12', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(90)
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 620, onComplete: () => t.destroy() })
  }

  blast(cells) {
    return new Promise((resolve) => {
      if (!cells.length) return resolve()
      this.cameras.main.shake(130, 0.006)
      let done = 0

      for (const { r, c } of cells) {
        const t = this.tiles[r][c]
        if (!t) { done++; if (done === cells.length) resolve(); continue }

        for (let i = 0; i < 6; i++) {
          const p = this.add.circle(t.sprite.x, t.sprite.y, Phaser.Math.Between(2, 5), Phaser.Display.Color.RandomRGB().color)
          const ang = Math.random() * Math.PI * 2
          const dist = Phaser.Math.Between(16, 44)
          this.tweens.add({
            targets: p,
            x: p.x + Math.cos(ang) * dist,
            y: p.y + Math.sin(ang) * dist,
            alpha: 0,
            duration: 250,
            onComplete: () => p.destroy(),
          })
        }

        this.tweens.add({
          targets: [t.sprite, t.bg, t.badge],
          scale: 0,
          alpha: 0,
          angle: Phaser.Math.Between(-24, 24),
          duration: 160,
          onComplete: () => {
            t.sprite.destroy(); t.bg.destroy(); t.badge.destroy()
            this.tiles[r][c] = null
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
        if (this.tiles[r][c]) {
          if (write !== r) {
            this.tiles[write][c] = this.tiles[r][c]
            this.tiles[write][c].r = write
            this.tiles[r][c] = null
          }
          write--
        }
      }
    }
  }

  animateGravity() {
    return new Promise((resolve) => {
      const tasks = []
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const t = this.tiles[r][c]
          if (!t) continue
          const y = this.offsetY + r * this.cell + this.cell / 2
          const x = this.offsetX + c * this.cell + this.cell / 2
          if (Math.abs(t.sprite.y - y) > 1 || Math.abs(t.sprite.x - x) > 1) {
            tasks.push(new Promise((res) => {
              this.tweens.add({ targets: [t.sprite, t.bg, t.badge], x, y, duration: 170 + (this.rows - r) * 10, ease: 'Bounce.Out', onComplete: res })
            }))
          }
        }
      }
      Promise.all(tasks).then(() => resolve())
      if (!tasks.length) resolve()
    })
  }

  fillEmpty() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.tiles[r][c]) {
          const t = this.spawnTile(c, r, this.randType(), false)
          t.sprite.y -= Phaser.Math.Between(80, 220)
          t.badge.y = t.sprite.y
          t.bg.y = this.offsetY + r * this.cell + this.cell / 2
          this.tiles[r][c] = t
        }
      }
    }
  }

  animateFill() {
    return new Promise((resolve) => {
      const tasks = []
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const t = this.tiles[r][c]
          const y = this.offsetY + r * this.cell + this.cell / 2
          const x = this.offsetX + c * this.cell + this.cell / 2
          if (Math.abs(t.sprite.y - y) > 1 || Math.abs(t.sprite.x - x) > 1) {
            tasks.push(new Promise((res) => this.tweens.add({ targets: [t.sprite, t.badge], x, y, duration: 230, ease: 'Back.Out', onComplete: res })))
          }
        }
      }
      Promise.all(tasks).then(resolve)
      if (!tasks.length) resolve()
    })
  }

  resolveAllAutoMatches() {
    const loop = async () => {
      const m = this.findMatches()
      if (!m.cells.length) return
      await this.resolveMatchesLoop(m)
      loop()
    }
    loop()
  }

  randomChaosEvent(inCascade = false) {
    const roll = Math.random()
    if (roll < 0.34) {
      this.cameras.main.shake(300, 0.012)
      this.popText('CHAOS SHAKE!')
      this.addScore(200 * (inCascade ? 2 : 1))
      this.sfxPower()
    } else if (roll < 0.67) {
      const r = Phaser.Math.Between(0, this.rows - 1)
      const c = Phaser.Math.Between(0, this.cols - 1)
      const t = this.tiles[r][c]
      if (t) {
        t.type = this.randType()
        t.power = Math.random() < 0.22 ? Phaser.Utils.Array.GetRandom(['row', 'col', 'bomb']) : null
        t.sprite.setTexture(`meme_${t.type}`)
        t.badge.setText(this.tilePowerText(t.power))
        this.tweens.add({ targets: [t.sprite, t.badge], angle: 360, duration: 260, onComplete: () => { t.sprite.angle = 0; t.badge.angle = 0 } })
        this.popText('MUTATION!')
      }
    } else {
      const flat = []
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) flat.push(this.tiles[r][c])
      Phaser.Utils.Array.Shuffle(flat)
      let i = 0
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const t = flat[i++]
          this.tiles[r][c] = t
          t.r = r; t.c = c
          const x = this.offsetX + c * this.cell + this.cell / 2
          const y = this.offsetY + r * this.cell + this.cell / 2
          this.tweens.add({ targets: [t.sprite, t.bg, t.badge], x, y, duration: 220, ease: 'Sine.Out' })
        }
      }
      this.popText('SHUFFLE STORM!')
      this.sfxBoom()
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#120b1f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 480,
    height: 860,
  },
  physics: { default: 'arcade' },
  scene: [BrainrotMatchScene],
})
