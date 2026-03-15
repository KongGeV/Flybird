// 获取Canvas和Context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const scoreElement = document.getElementById('score');

// 设置Canvas尺寸
canvas.width = 800;
canvas.height = 500;

// 游戏状态
let gameRunning = false;
let score = 0;
let baseGameSpeed = 0.8; // 保持初始速度不变
let gameSpeed = baseGameSpeed; // 当前游戏速度
let speedIncrement = 0.04; // 减小每过一个障碍物增加的速度(从0.08减小到0.04)
let maxGameSpeed = 2.8; // 降低最大游戏速度(从3.5降低到2.8)
let difficultyLevel = 0; // 难度等级
let maxDifficultyLevel = 7; // 最高难度上限
let consecutivePasses = 0; // 连续通过障碍物计数
let bonusActive = false; // 奖励模式标志
let bonusMultiplier = 1; // 奖励倍率，默认为1
let obstaclesPassed = 0; // 通过的障碍物数量
let isNightMode = false; // 夜晚模式状态
let dayNightTransition = 0; // 昼夜过渡效果计数(0-1之间)
let nightModeThreshold = 10; // 达到多少障碍物后进入夜晚模式
let obstacleTimer = null; // 障碍物生成计时器
let animationFrameId = null; // 动画帧ID

// 小鸟对象
const bird = {
    x: 100,
    y: 250,
    width: 40,
    height: 30,
    gravity: 0.08, // 大幅减小重力参数(从0.15减小到0.08)
    velocity: 0,
    maxFallSpeed: 2.5, // 减小最大下落速度(从3减小到2.5)
    jumpStrength: -5, // 保持跳跃高度不变
    wingAngle: 0, // 翅膀角度
    wingDirection: 1, // 翅膀扇动方向
    tailAngle: 0, // 尾巴角度
    tailDirection: 1, // 尾巴摆动方向
    blinkCounter: 0, // 眨眼计数器
    isBlinking: false, // 眨眼状态
    showTrajectory: false, // 轨迹预测默认关闭
    isGliding: false, // 滑翔状态
    glidingEnergy: 172, // 滑翔能量(再增加20%，从143到172)
    maxGlidingEnergy: 172, // 最大滑翔能量(再增加20%，从143到172)
    energyUseRate: 0.32, // 滑翔时能量消耗速率
    energyRechargeRate: 0, // 能量恢复速率设为0，移除主动恢复机制
    lastGlidingTime: 0, // 上次滑翔结束的时间
    glidingCooldown: 10000, // 滑翔冷却时间（10秒）
    isCooldown: false, // 是否在冷却中
    cooldownRemaining: 0, // 剩余冷却时间
    lastCooldownWarning: 0, // 上次冷却警告时间
    cooldownWarningInterval: 2000, // 冷却警告间隔（2秒）
    forwardBoost: 1.35, // 滑翔时的前进速度提升倍率（135%）

    draw() {
        // 如果启用了轨迹预测，则绘制轨迹
        if (this.showTrajectory) {
            this.drawTrajectory();
        }

        // 如果正在滑翔，显示剩余滑翔时间指示器
        if (this.isGliding) {
            this.drawGlidingIndicator();
        } else if (this.isCooldown) {
            // 如果在冷却中，显示冷却指示器
            this.drawCooldownIndicator();
        }

        // 角度动画
        this.wingAngle += 0.15 * this.wingDirection;
        if (this.wingAngle > 0.5 || this.wingAngle < -0.2) {
            this.wingDirection *= -1;
        }

        this.tailAngle += 0.05 * this.tailDirection;
        if (this.tailAngle > 0.3 || this.tailAngle < -0.3) {
            this.tailDirection *= -1;
        }

        // 眨眼动画
        this.blinkCounter++;
        if (this.blinkCounter > 120) { // 每2秒眨一次眼
            this.isBlinking = true;
            if (this.blinkCounter > 130) {
                this.blinkCounter = 0;
                this.isBlinking = false;
            }
        }

        // 判断是否处于奖励模式，如果是，使用金色
        const bodyColor = bonusActive ? '#FFD700' : '#ff6600';
        const wingColor = bonusActive ? '#FFA500' : '#ff0000';

        // 保存当前绘图状态
        ctx.save();

        // 夜晚模式下添加发光效果
        if (isNightMode || dayNightTransition > 0.3) {
            // 计算发光强度
            const glowIntensity = isNightMode ? 1 : ((dayNightTransition - 0.3) / 0.7);

            // 绘制发光效果
            ctx.shadowColor = bonusActive ? 'rgba(255, 215, 0, 0.8)' : 'rgba(255, 100, 0, 0.8)';
            ctx.shadowBlur = 15 * glowIntensity;
        }

        // 根据速度稍微旋转小鸟
        let rotationAngle = 0;

        if (this.isGliding) {
            // 滑翔时姿态更平稳，稍微向上
            rotationAngle = Math.max(-0.35, Math.min(0.1, -0.2 + this.velocity / 15));
        } else {
            // 正常飞行时根据速度旋转
            rotationAngle = Math.max(-0.3, Math.min(0.3, this.velocity / 15));
        }

        ctx.translate(this.x, this.y);
        ctx.rotate(rotationAngle);
        ctx.translate(-this.x, -this.y);

        // 绘制尾巴
        ctx.fillStyle = wingColor;
        ctx.beginPath();
        ctx.moveTo(this.x - 18, this.y - 5);
        ctx.lineTo(this.x - 30, this.y - 15 + this.tailAngle * 20);
        ctx.lineTo(this.x - 30, this.y + 5 + this.tailAngle * 20);
        ctx.lineTo(this.x - 18, this.y + 5);
        ctx.fill();

        // 绘制翅膀（在身体后面）
        ctx.fillStyle = wingColor;
        ctx.beginPath();

        if (this.isGliding) {
            // 滑翔时翅膀展开
            ctx.moveTo(this.x, this.y - 5);
            ctx.quadraticCurveTo(
                this.x - 10, this.y - 25,
                this.x - 35, this.y - 10
            );
            ctx.lineTo(this.x - 20, this.y);
        } else {
            // 正常飞行时翅膀扇动
            ctx.moveTo(this.x, this.y - 5);
            ctx.quadraticCurveTo(
                this.x - 5, this.y - 25 - this.wingAngle * 15,
                this.x - 20, this.y - 15 - this.wingAngle * 10
            );
            ctx.lineTo(this.x - 10, this.y);
        }

        ctx.fill();

        // 绘制身体
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
        ctx.fill();

        // 绘制翅膀（在身体前面）
        ctx.fillStyle = wingColor;
        ctx.beginPath();

        if (this.isGliding) {
            // 滑翔时翅膀展开
            ctx.moveTo(this.x, this.y + 5);
            ctx.quadraticCurveTo(
                this.x - 10, this.y + 25,
                this.x - 35, this.y + 10
            );
            ctx.lineTo(this.x - 20, this.y);
        } else {
            // 正常飞行时翅膀扇动
            ctx.moveTo(this.x, this.y + 5);
            ctx.quadraticCurveTo(
                this.x - 5, this.y + 25 + this.wingAngle * 15,
                this.x - 20, this.y + 15 + this.wingAngle * 10
            );
            ctx.lineTo(this.x - 10, this.y);
        }

        ctx.fill();

        // 绘制眼睛
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x + 10, this.y - 5, 7, 0, Math.PI * 2);
        ctx.fill();

        // 眼珠
        if (!this.isBlinking) {
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(this.x + 12, this.y - 5, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // 眼睛高光
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(this.x + 13, this.y - 6, 1.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // 眨眼状态
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x + 7, this.y - 5);
            ctx.lineTo(this.x + 14, this.y - 5);
            ctx.stroke();
        }

        // 绘制鸟嘴
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        ctx.moveTo(this.x + 18, this.y + 5);
        ctx.lineTo(this.x + 35, this.y);
        ctx.lineTo(this.x + 18, this.y - 5);
        ctx.closePath();
        ctx.fill();

        // 绘制小鸟的脚
        ctx.fillStyle = '#FF8C00'; // 橙色的脚

        // 左脚
        ctx.beginPath();
        ctx.moveTo(this.x - 5, this.y + 18);
        ctx.lineTo(this.x - 12, this.y + 28);
        ctx.lineTo(this.x - 18, this.y + 26);
        ctx.lineTo(this.x - 12, this.y + 24);
        ctx.lineTo(this.x - 5, this.y + 18);
        ctx.fill();

        // 右脚
        ctx.beginPath();
        ctx.moveTo(this.x + 5, this.y + 18);
        ctx.lineTo(this.x + 12, this.y + 28);
        ctx.lineTo(this.x + 18, this.y + 26);
        ctx.lineTo(this.x + 12, this.y + 24);
        ctx.lineTo(this.x + 5, this.y + 18);
        ctx.fill();

        // 绘制奖励模式光环（如果激活）
        if (bonusActive) {
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 30, 0, Math.PI * 2);
            ctx.stroke();

            // 绘制小星星
            const time = Date.now() / 200;
            for (let i = 0; i < 5; i++) {
                const angle = time + i * Math.PI * 2 / 5;
                const starX = this.x + Math.cos(angle) * 40;
                const starY = this.y + Math.sin(angle) * 40;
                this.drawStar(starX, starY, 5, 2.5, 5);
            }
        }

        // 恢复绘图状态
        ctx.restore();
    },

    // 辅助方法：绘制星星
    drawStar(cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        let step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);

        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }

        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fillStyle = '#FFD700';
        ctx.fill();
    },

    // 绘制轨迹预测
    drawTrajectory() {
        // 保存当前状态
        const currentY = this.y;
        const currentVelocity = this.velocity;
        const currentGliding = this.isGliding;
        const currentEnergy = this.glidingEnergy;

        // 预测点数量
        const numPoints = 12; // 增加预测点数量
        // 轨迹点
        const points = [];

        // 临时计算未来位置
        let tempY = currentY;
        let tempVelocity = currentVelocity;
        let tempGliding = currentGliding;
        let tempEnergy = currentEnergy;

        // 计算未来几帧的位置
        for (let i = 0; i < numPoints; i++) {
            // 更新滑翔状态
            if (tempGliding) {
                // 消耗能量
                tempEnergy -= this.energyUseRate;
                if (tempEnergy <= 0) {
                    tempGliding = false;
                    tempEnergy = 0;
                }
            }

            // 应用重力和空气阻力
            if (tempGliding) {
                // 滑翔物理
                tempVelocity += this.gravity * 0.1;

                if (tempVelocity > 0.2) {
                    tempVelocity *= 0.95;
                }

                tempVelocity *= 0.98;

                if (tempVelocity > 0.4) {
                    tempVelocity = 0.4;
                }
            } else {
                // 正常物理
                tempVelocity += this.gravity;
                tempVelocity *= 0.97;
            }

            // 限制下落速度
            if (tempVelocity > this.maxFallSpeed) {
                tempVelocity = this.maxFallSpeed;
            }

            tempY += tempVelocity;

            // 防止超出边界
            if (tempY > canvas.height - 20) {
                tempY = canvas.height - 20;
            }
            if (tempY < 20) {
                tempY = 20;
            }

            points.push({ x: this.x + i * 12, y: tempY });
        }

        // 绘制预测点
        ctx.save();
        for (let i = 0; i < points.length; i++) {
            // 随着距离增加透明度降低
            const alpha = 0.8 - i * (0.7 / points.length);

            // 滑翔时轨迹点使用蓝色，否则使用白色
            let color;
            if (this.isGliding) {
                // 根据剩余能量改变颜色
                const energyRatio = this.glidingEnergy / this.maxGlidingEnergy;
                const r = Math.floor(135 - energyRatio * 135);
                const g = Math.floor(206 - energyRatio * 36);
                const b = 250;
                color = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            } else if (this.isCooldown) {
                // 冷却中使用红色
                color = `rgba(220, 20, 60, ${alpha})`;
            } else {
                // 正常状态使用白色
                color = `rgba(255, 255, 255, ${alpha})`;
            }

            ctx.fillStyle = color;

            // 绘制小圆点
            ctx.beginPath();
            ctx.arc(points[i].x, points[i].y, 3 - i * (2 / points.length), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    // 绘制滑翔能量指示器
    drawGlidingIndicator() {
        const energyPercentage = this.glidingEnergy / this.maxGlidingEnergy;

        // 在小鸟上方绘制指示器
        ctx.save();

        // 绘制外环
        ctx.strokeStyle = 'rgba(135, 206, 250, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 35, 0, Math.PI * 2);
        ctx.stroke();

        // 绘制能量环
        // 能量低时变红，高时为蓝色
        const r = Math.floor(135 - energyPercentage * 135 + 120 * (1 - energyPercentage));
        const g = Math.floor(206 - energyPercentage * 36);
        const b = 250;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 35, -Math.PI / 2, -Math.PI / 2 + (energyPercentage * Math.PI * 2));
        ctx.stroke();

        // 显示能量百分比
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';

        const energyText = `${Math.floor(energyPercentage * 100)}%`;
        ctx.fillText(energyText, this.x, this.y - 40);

        ctx.restore();
    },

    // 绘制冷却指示器
    drawCooldownIndicator() {
        if (!this.isCooldown) return;

        const percentage = this.cooldownRemaining / this.glidingCooldown;

        // 在小鸟上方绘制冷却指示器
        ctx.save();

        // 绘制外环
        ctx.strokeStyle = 'rgba(255, 99, 71, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 40, 0, Math.PI * 2);
        ctx.stroke();

        // 绘制填充进度条
        ctx.strokeStyle = 'rgba(220, 20, 60, 0.5)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 40, -Math.PI / 2, -Math.PI / 2 + (percentage * Math.PI * 2));
        ctx.stroke();

        // 显示剩余冷却时间
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`冷却中: ${Math.ceil(this.cooldownRemaining / 1000)}s`, this.x, this.y - 45);

        // 显示能量恢复提示
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '10px Arial';
        ctx.fillText('能量恢复中...', this.x, this.y - 30);

        ctx.restore();
    },

    update() {
        // 滑翔系统更新
        if (this.isGliding) {
            // 消耗滑翔能量
            this.glidingEnergy -= this.energyUseRate;

            // 能量耗尽，结束滑翔并进入冷却
            if (this.glidingEnergy <= 0) {
                this.glidingEnergy = 0;
                this.stopGliding();
            }
        }
        // 移除非冷却状态下的能量恢复
        // 现在只有在冷却结束后才恢复能量

        // 冷却计时处理
        if (this.isCooldown) {
            const currentTime = Date.now();
            this.cooldownRemaining = this.glidingCooldown - (currentTime - this.lastGlidingTime);

            if (this.cooldownRemaining <= 0) {
                this.isCooldown = false;
                this.cooldownRemaining = 0;
                this.glidingEnergy = this.maxGlidingEnergy; // 冷却后完全恢复能量
                // 滑翔能量已完全恢复 提示已移除
            }
        }

        // 应用重力与滑翔物理效果
        if (this.isGliding) {
            // 滑翔时重力极大减小，但不会向上飞
            this.velocity += this.gravity * 0.1; // 滑翔时重力仅为正常的10%

            // 高级空气动力学效果
            if (this.velocity > 0.2) {
                // 下降过快时转换部分下降动能为水平动能，减缓下落
                this.velocity *= 0.95;
            }

            // 滑翔时空气阻力大幅增加
            this.velocity *= 0.98;

            // 限制滑翔最大下落速度为极小值，实现几乎水平飞行
            if (this.velocity > 0.4) {
                this.velocity = 0.4;
            }
        } else {
            // 正常飞行物理
            this.velocity += this.gravity;
            this.velocity *= 0.97; // 标准空气阻力
        }

        // 限制最大下落速度
        if (this.velocity > this.maxFallSpeed) {
            this.velocity = this.maxFallSpeed;
        }

        this.y += this.velocity;

        // 防止小鸟飞出Canvas
        if (this.y > canvas.height - 20) {
            this.y = canvas.height - 20;
            this.velocity = 0;
        }
        if (this.y < 20) {
            this.y = 20;
            this.velocity = 0;
        }
    },

    jump() {
        // 加入更平滑的跳跃
        if (this.velocity > 0) {
            // 如果正在下落，则给予适当的跳跃力
            this.velocity = this.jumpStrength * 1.1;
        } else {
            // 如果已经在上升，给予较小的额外推力
            this.velocity = this.jumpStrength;
        }
    },

    reset() {
        this.y = 250;
        this.velocity = 0;
    },

    startGliding() {
        // 检查是否在冷却中
        if (this.isCooldown) {
            // 限制冷却提示频率
            const currentTime = Date.now();
            if (currentTime - this.lastCooldownWarning >= this.cooldownWarningInterval) {
                const cdSeconds = Math.ceil(this.cooldownRemaining / 1000);
                // 滑翔冷却提示已移除
                this.lastCooldownWarning = currentTime;
            }
            return;
        }

        // 检查是否有能量
        if (this.glidingEnergy <= 0) {
            // 滑翔能量耗尽提示已移除
            return;
        }

        if (!this.isGliding) {
            this.isGliding = true;

            // 水平化当前速度向量 - 如果正在快速下落，减缓下落
            if (this.velocity > 1.0) {
                this.velocity = 0.5;
            }

            // 只在首次开始滑翔时显示提示
            if (this.glidingEnergy === this.maxGlidingEnergy) {
                // 滑翔启动提示已移除（保留开始时的滑翔说明）
            }
        }
    },

    stopGliding() {
        if (this.isGliding) {
            this.isGliding = false;

            // 只有在能量耗尽时进入冷却
            if (this.glidingEnergy <= 0) {
                // 记录滑翔结束时间
                this.lastGlidingTime = Date.now();
                this.isCooldown = true;
                this.cooldownRemaining = this.glidingCooldown;
                // 滑翔能量耗尽进入冷却的提示已移除
            }
        }
    }
};

// 障碍物数组
let obstacles = [];

// 障碍物类
class Obstacle {
    constructor(offsetX = 0, offsetY = 0, isPartOfGroup = false) {
        this.x = canvas.width + offsetX;

        // 根据难度增加障碍物宽度，但确保难度1保持简单
        let widthIncrease = 0; // 难度1不增加宽度

        if (difficultyLevel >= 2) {
            widthIncrease = difficultyLevel * 0.5; // 难度2及以上开始大幅增加宽度
        }
        if (difficultyLevel >= 4) {
            widthIncrease = difficultyLevel * 0.7; // 难度4及以上进一步增加宽度
        }
        if (difficultyLevel >= 6) {
            widthIncrease = difficultyLevel * 0.9; // 难度6及以上进一步增加宽度
        }

        this.width = 60 + Math.min(18, widthIncrease); // 减小基础宽度，确保有可通过空间

        this.isPartOfGroup = isPartOfGroup;

        // 计算基础间隙并根据难度调整
        // 难度1保持足够宽的通道
        let baseGap = 250;
        let minGap = 180; // 提高最小间隙以确保可通过性

        // 确保难度2及以上的间隙大小按照难度递减，但始终保持可通过性
        if (difficultyLevel >= 2) {
            // 每增加一级难度减小一定间隙，但保证最低限度
            baseGap -= (difficultyLevel - 1) * 15;
            minGap -= (difficultyLevel - 1) * 5;

            // 确保间隙始终足够小鸟通过(考虑跳跃和下落的高度)
            minGap = Math.max(minGap, 145);
        }

        this.gap = Math.max(minGap, baseGap - (difficultyLevel * 10));

        // 计算障碍物的位置，确保留有足够空间让小鸟通过
        let heightRandomFactor = 0.8; // 降低难度1的随机因子

        if (difficultyLevel >= 2) {
            heightRandomFactor = 1.0; // 难度2恢复正常随机性
        }
        if (difficultyLevel >= 4) {
            heightRandomFactor = 1.2; // 难度4增加随机性
        }

        // 如果是分组障碍物，添加垂直偏移
        if (offsetY !== 0) {
            let randomOffset = Math.sin(Date.now() / 1000) * 30; // 减小随机偏移量

            this.topHeight = Math.min(
                Math.max(
                    60, // 增加最小高度，确保有空间通过
                    Math.random() * heightRandomFactor * (canvas.height - this.gap - 150) + 60 + randomOffset + offsetY
                ),
                canvas.height - this.gap - 60 // 确保底部也有足够空间
            );
        } else {
            let randomOffset = Math.sin(Date.now() / 1000) * 30;

            this.topHeight = Math.min(
                Math.max(
                    60,
                    Math.random() * heightRandomFactor * (canvas.height - this.gap - 150) + 60 + randomOffset
                ),
                canvas.height - this.gap - 60
            );
        }

        this.bottomY = this.topHeight + this.gap;
        this.passed = false;

        // 难度2及以上添加移动效果，但确保移动幅度合理
        this.hasVerticalMovement = false;
        this.verticalSpeed = 0;
        this.verticalRange = 0;
        this.originalTopHeight = this.topHeight;

        if (difficultyLevel >= 2) {
            let movementProb = 0.1; // 难度2：10%概率移动

            if (difficultyLevel >= 3) {
                movementProb = 0.2; // 难度3：20%概率移动
            }
            if (difficultyLevel >= 5) {
                movementProb = 0.3; // 难度5：30%概率移动
            }
            if (difficultyLevel >= 7) {
                movementProb = 0.4; // 难度7：40%概率移动
            }

            if (Math.random() < movementProb) {
                this.hasVerticalMovement = true;
                // 根据难度调整移动速度，但始终保持可预测性
                this.verticalSpeed = 0.3 + (difficultyLevel - 2) * 0.1;
                // 限制移动范围，确保不会使通道突然变得无法通过
                this.verticalRange = Math.min(20 + (difficultyLevel - 2) * 5, 35);
                this.verticalDirection = Math.random() > 0.5 ? 1 : -1;
            }
        }
    }

    draw() {
        // 根据昼夜模式调整障碍物颜色
        let obstacleColor, topColor;

        if (isNightMode || dayNightTransition > 0) {
            obstacleColor = blendColors('#8B4513', '#3A1F0D', dayNightTransition);
            topColor = blendColors('#3CB371', '#1C5A38', dayNightTransition);
        } else {
            obstacleColor = '#8B4513';
            topColor = '#3CB371';
        }

        // 绘制顶部障碍物
        ctx.fillStyle = obstacleColor;
        ctx.fillRect(this.x, 0, this.width, this.topHeight);

        // 绘制底部障碍物
        ctx.fillRect(this.x, this.bottomY, this.width, canvas.height - this.bottomY);

        // 绘制顶部障碍物的顶端
        ctx.fillStyle = topColor;
        ctx.fillRect(this.x - 10, this.topHeight - 20, this.width + 20, 20);

        // 绘制底部障碍物的顶端
        ctx.fillRect(this.x - 10, this.bottomY, this.width + 20, 20);
    }

    update() {
            // 更新垂直移动
            if (this.hasVerticalMovement) {
                this.topHeight += this.verticalSpeed * this.verticalDirection;
                // 检查是否达到移动范围的边界
                if (Math.abs(this.topHeight - this.originalTopHeight) > this.verticalRange) {
                    this.verticalDirection *= -1; // 改变移动方向
                }
                this.bottomY = this.topHeight + this.gap;
            }

            // 更新水平位置 - 滑翔状态下障碍物移动更快(相对效果)
            if (bird.isGliding) {
                this.x -= gameSpeed * bird.forwardBoost;
            } else {
                this.x -= gameSpeed;
            }

            // 检查碰撞 - 使用更宽松的碰撞检测
            if (
                bird.x + 15 > this.x && // 减小碰撞检测范围(原为20)
                bird.x - 15 < this.x + this.width && // 减小碰撞检测范围(原为20)
                (bird.y - 15 < this.topHeight || bird.y + 15 > this.bottomY) // 减小碰撞检测范围(原为20)
            ) {
                gameOver();
            }

            // 检查是否通过障碍物
            if (!this.passed && this.x + this.width < bird.x) {
                // 如果是组合障碍物的一部分，只有不在组中的障碍物计算分数
                if (!this.isPartOfGroup) {
                    // 增加连续通过计数
                    consecutivePasses++;
                    // 增加通过的障碍物总数
                    obstaclesPassed++;

                    // 检查是否应该切换到夜晚模式
                    if (obstaclesPassed >= nightModeThreshold && !isNightMode) {
                        // 开始昼夜过渡
                        // 夜幕降临提示已移除
                    }

                    // 更新难度等级 - 前两级每4个障碍物提升一级，之后每6个障碍物提升一级
                    const oldDifficultyLevel = difficultyLevel;

                    // 新的难度提升算法
                    if (obstaclesPassed < 8) {
                        // 从0到2级，每4个障碍物提升一级
                        difficultyLevel = Math.min(2, Math.floor(obstaclesPassed / 4));
                    } else {
                        // 3级及以上，每6个障碍物提升一级，但要加上前面已经提升的2级
                        difficultyLevel = Math.min(maxDifficultyLevel, 2 + Math.floor((obstaclesPassed - 8) / 6));
                    }

                    // 增加游戏速度和难度，难度3及以上大幅加速
                    if (gameSpeed < maxGameSpeed) {
                        if (difficultyLevel >= 3) {
                            gameSpeed = Math.min(maxGameSpeed, baseGameSpeed + (difficultyLevel * speedIncrement * 4));
                        } else {
                            gameSpeed = Math.min(maxGameSpeed, baseGameSpeed + (difficultyLevel * speedIncrement * 3));
                        }
                    }

                    // 显示难度提升提示
                    if (difficultyLevel > oldDifficultyLevel) {
                        if (difficultyLevel >= 3) {
                            // 难度提升提示（噩梦模式）已移除
                        } else {
                            // 难度提升提示已移除
                        }

                        // 如果达到最高难度，显示特殊提示
                        if (difficultyLevel >= maxDifficultyLevel) {
                            setTimeout(() => {
                                // 已达到最高难度提示已移除
                            }, 2000);
                        }
                    }

                    // 更新奖励倍率
                    updateBonusMultiplier();

                    // 计算得分
                    let pointsEarned = 1 * bonusMultiplier;

                    score += pointsEarned;
                    scoreElement.textContent = `分数: ${score}${bonusActive ? ` (x${bonusMultiplier})` : ''} | 难度: ${difficultyLevel + 1}`;
            }
            
            this.passed = true;
        }
    }
}

// 更新奖励倍率的函数
function updateBonusMultiplier() {
    // 根据通过的障碍物数量确定倍率 - 修改为与新难度提升对应
    if (obstaclesPassed >= 20) { // 难度4+
        bonusMultiplier = 5; // 5倍
    } else if (obstaclesPassed >= 14) { // 难度3+
        bonusMultiplier = 4; // 4倍
    } else if (obstaclesPassed >= 8) { // 难度2+
        bonusMultiplier = 3; // 3倍
    } else if (obstaclesPassed >= 4) { // 难度1+
        bonusMultiplier = 2; // 2倍
    } else {
        bonusMultiplier = 1; // 默认倍率
    }

    // 激活奖励模式
    if (bonusMultiplier > 1 && !bonusActive) {
        activateBonusMode();
    }
}

// 激活奖励模式的函数
function activateBonusMode() {
    bonusActive = true;

    // 显示奖励模式动画/文字
    const bonusText = document.createElement('div');
    bonusText.textContent = `奖励模式！分数 x${bonusMultiplier}`;
    bonusText.style.position = 'absolute';
    bonusText.style.top = '150px';
    bonusText.style.left = '50%';
    bonusText.style.transform = 'translateX(-50%)';
    bonusText.style.color = '#FFD700';
    bonusText.style.fontSize = '24px';
    bonusText.style.fontWeight = 'bold';
    bonusText.style.textShadow = '0 0 10px #FFA500';
    bonusText.style.zIndex = '100';
    bonusText.style.opacity = '1';
    bonusText.style.transition = 'opacity 2s';

    document.querySelector('.game-container').appendChild(bonusText);

    // 淡出效果
    setTimeout(() => {
        bonusText.style.opacity = '0';
        setTimeout(() => {
            bonusText.remove();
        }, 2000);
    }, 100);
}

// 创建障碍物
function createObstacles() {
    // 清除可能存在的旧计时器
    if (obstacleTimer) {
        clearInterval(obstacleTimer);
    }

    // 根据难度设置初始间隔
    let interval = 4000; // 难度1较长间隔
    
    // 难度2及以上减少间隔
    if (difficultyLevel >= 2) {
        interval = 3400;
    }
    if (difficultyLevel >= 4) {
        interval = 3000;
    }

    // 设置新计时器
    obstacleTimer = setInterval(() => {
        if (gameRunning) {
            // 根据难度等级决定障碍物类型
            let obstacleType = Math.random();
            
            // 调整障碍物生成概率
            let singleObstacleProb = 1.0;  // 单个障碍物概率
            let doubleObstacleProb = 0.0;  // 双障碍物概率
            let tripleObstacleProb = 0.0;  // 三障碍物概率
            
            // 难度1只有单个障碍物
            if (difficultyLevel >= 2) {
                // 难度2开始引入双障碍物
                singleObstacleProb = 0.7;
                doubleObstacleProb = 0.3;
            }
            if (difficultyLevel >= 3) {
                // 难度3引入三障碍物
                singleObstacleProb = 0.6;
                doubleObstacleProb = 0.3;
                tripleObstacleProb = 0.1;
            }
            if (difficultyLevel >= 4) {
                singleObstacleProb = 0.5;
                doubleObstacleProb = 0.3;
                tripleObstacleProb = 0.2;
            }
            if (difficultyLevel >= 5) {
                singleObstacleProb = 0.4;
                doubleObstacleProb = 0.35;
                tripleObstacleProb = 0.25;
            }
            if (difficultyLevel >= 6) {
                singleObstacleProb = 0.3;
                doubleObstacleProb = 0.35;
                tripleObstacleProb = 0.35;
            }
            
            // 基础障碍物
            if (obstacleType < singleObstacleProb) {
                // 创建单个障碍物
                obstacles.push(new Obstacle());
            }
            // 双障碍物
            else if (obstacleType < singleObstacleProb + doubleObstacleProb) {
                // 第一个障碍物
                obstacles.push(new Obstacle());
                
                // 根据难度调整第二个障碍物的偏移量
                // 确保障碍物之间有足够的间距
                let offsetX = 220; // 增加基础间距
                let offsetY = 50;
                
                // 难度越高，障碍物间距越小，但保证最小间距
                if (difficultyLevel >= 3) {
                    offsetX = Math.max(200, 220 - (difficultyLevel - 2) * 10);
                }
                
                // 第二个障碍物，水平偏移
                obstacles.push(new Obstacle(offsetX, offsetY, true));
            }
            // 三障碍物
            else {
                // 第一个障碍物
                obstacles.push(new Obstacle());
                
                // 确保有足够的间距可以通过
                let offset1X = 220;
                let offset1Y = 50;
                let offset2X = 380; // 增加第三个障碍物的距离
                let offset2Y = -60;
                
                // 难度越高，障碍物间距越小，但保证最小间距
                if (difficultyLevel >= 4) {
                    offset1X = Math.max(200, 220 - (difficultyLevel - 3) * 10);
                    offset2X = Math.max(350, 380 - (difficultyLevel - 3) * 15);
                }
                
                // 第二个障碍物
                obstacles.push(new Obstacle(offset1X, offset1Y, true));
                // 第三个障碍物
                obstacles.push(new Obstacle(offset2X, offset2Y, true));
            }

            // 动态调整间隔时间
            if (difficultyLevel < 2) {
                // 难度1保持较长间隔
                interval = 4000;
            } else {
                // 难度2及以上，根据难度递减间隔
                interval = Math.max(2600, 3400 - (difficultyLevel - 2) * 200);
                
                // 难度4及以上，进一步减少但确保可玩性
                if (difficultyLevel >= 4) {
                    interval = Math.max(2200, interval - 200);
                }
                
                // 难度6及以上
                if (difficultyLevel >= 6) {
                    interval = Math.max(1800, interval - 200);
                }
            }

            // 重新设置计时器
            clearInterval(obstacleTimer);
            obstacleTimer = setInterval(arguments.callee, interval);
        }
    }, interval);
}

// 定义森林树木 - 避免树木重叠
const trees = [];
// 将画布宽度分成几个区域
const sections = 10;
const sectionWidth = canvas.width / sections;

for (let i = 0; i < sections; i++) {
    // 在每个区域内放置1-2棵树
    const numTrees = 1 + Math.floor(Math.random() * 2);

    for (let j = 0; j < numTrees; j++) {
        // 在区域内随机位置
        const x = i * sectionWidth + Math.random() * sectionWidth;
        const height = 30 + Math.random() * 60;
        const width = 15 + Math.random() * 10;

        trees.push({
            x: x,
            y: canvas.height - 30, // 在地面上
            height: height,
            width: width,
            depth: Math.random() // 用于确定树的深度/远近
        });
    }
}

// 排序树木，使远处的树在前面绘制（深度越小越远）
trees.sort((a, b) => a.depth - b.depth);

// 定义山脉 - 确保位置不重叠
const mountains = [];
for (let i = 0; i < 5; i++) {
    const mountainWidth = 180 + Math.random() * 80;
    const mountainHeight = 80 + Math.random() * 40;
    const x = i * (canvas.width / 5) + (Math.random() * 50 - 25);

    mountains.push({
        x: x,
        width: mountainWidth,
        height: mountainHeight,
        color: `rgb(${120 + Math.random() * 30}, ${130 + Math.random() * 30}, ${180 + Math.random() * 30})`
    });
}

// 绘制背景
function drawBackground() {
    // 绘制天空渐变
    let skyGradient;
    if (isNightMode || dayNightTransition > 0) {
        // 夜晚或过渡状态下的天空
        skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);

        // 根据过渡状态混合颜色
        const dayTop = 'rgb(135, 206, 235)';
        const dayBottom = 'rgb(176, 226, 255)';
        const nightTop = 'rgb(25, 25, 112)';
        const nightBottom = 'rgb(0, 0, 50)';

        const topColor = blendColors(dayTop, nightTop, dayNightTransition);
        const bottomColor = blendColors(dayBottom, nightBottom, dayNightTransition);

        skyGradient.addColorStop(0, topColor);
        skyGradient.addColorStop(1, bottomColor);
    } else {
        // 白天的天空
        skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        skyGradient.addColorStop(0, '#87CEEB');
        skyGradient.addColorStop(1, '#B0E2FF');
    }

    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 夜晚模式下绘制星星和月亮
    if (dayNightTransition > 0) {
        drawNightSkyElements();
    }

    // 绘制远处的山脉
    mountains.forEach(mountain => {
        // 根据昼夜状态调整山脉颜色
        let mountainColor;
        if (isNightMode || dayNightTransition > 0) {
            const dayColor = mountain.color;
            const nightColor = darkenColor(mountain.color, 0.7);
            mountainColor = blendColors(dayColor, nightColor, dayNightTransition);
        } else {
            mountainColor = mountain.color;
        }

        ctx.fillStyle = mountainColor;
        ctx.beginPath();
        ctx.moveTo(mountain.x, canvas.height - 30);
        ctx.lineTo(mountain.x + mountain.width / 2, canvas.height - 30 - mountain.height);
        ctx.lineTo(mountain.x + mountain.width, canvas.height - 30);
        ctx.fill();
    });

    // 绘制森林（树木）
    trees.forEach(tree => {
        // 根据深度确定颜色 - 远处的树更浅色
        let colorVal = Math.floor(120 + tree.depth * 100);
        let treeColor;

        // 夜晚模式下暗化树木颜色
        if (isNightMode || dayNightTransition > 0) {
            const dayColorVal = colorVal;
            const nightColorVal = dayColorVal * 0.3; // 夜晚更暗
            colorVal = Math.floor(dayColorVal + (nightColorVal - dayColorVal) * dayNightTransition);

            const dayTreeColor = `rgb(${Math.min(30, dayColorVal - 90)}, ${dayColorVal}, ${Math.min(30, dayColorVal - 90)})`;
            const nightTreeColor = `rgb(${Math.min(30, colorVal - 90) * 0.5}, ${colorVal * 0.5}, ${Math.min(30, colorVal - 90) * 0.5})`;
            treeColor = blendColors(dayTreeColor, nightTreeColor, dayNightTransition);
        } else {
            treeColor = `rgb(${Math.min(30, colorVal - 90)}, ${colorVal}, ${Math.min(30, colorVal - 90)})`;
        }

        // 树干颜色
        let trunkColor;
        if (isNightMode || dayNightTransition > 0) {
            trunkColor = blendColors('#8B4513', '#3A1F0D', dayNightTransition);
        } else {
            trunkColor = '#8B4513';
        }

        // 树干
        ctx.fillStyle = trunkColor;
        ctx.fillRect(tree.x, tree.y - tree.height, tree.width / 3, tree.height);

        // 树冠 - 使用深度调整颜色
        ctx.fillStyle = treeColor;
        ctx.beginPath();
        ctx.moveTo(tree.x - tree.width / 2, tree.y - tree.height / 2);
        ctx.lineTo(tree.x + tree.width / 6, tree.y - tree.height - tree.width / 2);
        ctx.lineTo(tree.x + tree.width, tree.y - tree.height / 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(tree.x - tree.width / 3, tree.y - tree.height / 1.5);
        ctx.lineTo(tree.x + tree.width / 6, tree.y - tree.height - tree.width / 3);
        ctx.lineTo(tree.x + tree.width * 0.8, tree.y - tree.height / 1.5);
        ctx.fill();
    });

    // 绘制草地
    let grassColor1, grassColor2;
    if (isNightMode || dayNightTransition > 0) {
        grassColor1 = blendColors('#90EE90', '#1C421C', dayNightTransition);
        grassColor2 = blendColors('#32CD32', '#0F290F', dayNightTransition);
    } else {
        grassColor1 = '#90EE90';
        grassColor2 = '#32CD32';
    }

    const grassGradient = ctx.createLinearGradient(0, canvas.height - 30, 0, canvas.height);
    grassGradient.addColorStop(0, grassColor1);
    grassGradient.addColorStop(1, grassColor2);
    ctx.fillStyle = grassGradient;
    ctx.fillRect(0, canvas.height - 30, canvas.width, 30);

    // 绘制太阳或月亮
    if (isNightMode || dayNightTransition > 0.5) {
        // 月亮
        const moonOpacity = Math.min(1, (dayNightTransition - 0.5) * 2);
        ctx.fillStyle = `rgba(230, 230, 250, ${moonOpacity})`;
        ctx.beginPath();
        ctx.arc(canvas.width - 50, 50, 30, 0, Math.PI * 2);
        ctx.fill();

        // 月亮表面纹理
        ctx.fillStyle = `rgba(200, 200, 220, ${moonOpacity * 0.3})`;
        ctx.beginPath();
        ctx.arc(canvas.width - 60, 40, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(canvas.width - 40, 60, 8, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // 太阳
        const sunOpacity = Math.max(0, 1 - dayNightTransition * 2);
        ctx.fillStyle = `rgba(255, 215, 0, ${sunOpacity})`;
        ctx.beginPath();
        ctx.arc(canvas.width - 50, 50, 30, 0, Math.PI * 2);
        ctx.fill();

        // 绘制太阳光芒
        ctx.strokeStyle = `rgba(255, 215, 0, ${sunOpacity})`;
        ctx.lineWidth = 3;
        for (let i = 0; i < 12; i++) {
            const angle = i * Math.PI / 6;
            const x1 = canvas.width - 50 + Math.cos(angle) * 35;
            const y1 = 50 + Math.sin(angle) * 35;
            const x2 = canvas.width - 50 + Math.cos(angle) * 45;
            const y2 = 50 + Math.sin(angle) * 45;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }
}

// 绘制夜晚的天空元素（星星）
function drawNightSkyElements() {
    // 星星的数量随过渡增加
    const numStars = Math.floor(100 * dayNightTransition);

    // 创建星星（使用一个固定的随机种子，让星星位置稳定）
    for (let i = 0; i < numStars; i++) {
        const x = (Math.sin(i * 463.3) * 0.5 + 0.5) * canvas.width;
        const y = (Math.cos(i * 217.9) * 0.5 + 0.3) * canvas.height;
        const size = Math.random() * 2 + 1;
        const opacity = Math.random() * 0.5 + 0.5;

        // 闪烁效果
        const time = Date.now() / 1000;
        const flicker = 0.7 + 0.3 * Math.sin(time * 3 + i);

        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * flicker * dayNightTransition})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        // 偶尔添加一颗彩色星
        if (i % 20 === 0) {
            // 随机颜色：红、蓝、紫
            const colors = ['255, 150, 150', '150, 150, 255', '200, 100, 255'];
            const color = colors[i % colors.length];

            ctx.fillStyle = `rgba(${color}, ${opacity * 0.7 * dayNightTransition})`;
            ctx.beginPath();
            ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// 颜色混合函数
function blendColors(color1, color2, ratio) {
    // 解析颜色
    function parseColor(color) {
        if (color.startsWith('rgb')) {
            const parts = color.match(/\d+/g);
            return {
                r: parseInt(parts[0]),
                g: parseInt(parts[1]),
                b: parseInt(parts[2])
            };
        } else if (color.startsWith('#')) {
            const hex = color.substring(1);
            return {
                r: parseInt(hex.substring(0, 2), 16),
                g: parseInt(hex.substring(2, 4), 16),
                b: parseInt(hex.substring(4, 6), 16)
            };
        }
    }

    const c1 = parseColor(color1);
    const c2 = parseColor(color2);

    const r = Math.floor(c1.r + (c2.r - c1.r) * ratio);
    const g = Math.floor(c1.g + (c2.g - c1.g) * ratio);
    const b = Math.floor(c1.b + (c2.b - c1.b) * ratio);

    return `rgb(${r}, ${g}, ${b})`;
}

// 颜色暗化函数
function darkenColor(color, factor) {
    const c = parseColor(color);
    return `rgb(${Math.floor(c.r * factor)}, ${Math.floor(c.g * factor)}, ${Math.floor(c.b * factor)})`;
}

// 辅助函数：解析颜色
function parseColor(color) {
    if (color.startsWith('rgb')) {
        const parts = color.match(/\d+/g);
        return {
            r: parseInt(parts[0]),
            g: parseInt(parts[1]),
            b: parseInt(parts[2])
        };
    } else if (color.startsWith('#')) {
        const hex = color.substring(1);
        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16)
        };
    }
    return { r: 0, g: 0, b: 0 };
}

// 游戏循环
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 更新昼夜过渡
    updateDayNightCycle();

    drawBackground();

    // 更新和绘制小鸟
    bird.update();
    bird.draw();

    // 更新和绘制障碍物
    obstacles = obstacles.filter(obstacle => obstacle.x + obstacle.width > 0);
    obstacles.forEach(obstacle => {
        obstacle.update();
        obstacle.draw();
    });

    if (gameRunning) {
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}

// 更新昼夜循环
function updateDayNightCycle() {
    if (obstaclesPassed >= nightModeThreshold) {
        // 缓慢过渡到夜晚模式
        if (dayNightTransition < 1) {
            dayNightTransition += 0.005; // 慢慢变黑
            if (dayNightTransition >= 1) {
                dayNightTransition = 1;
                isNightMode = true;
            }
        }
    } else {
        // 保持白天模式
        dayNightTransition = 0;
        isNightMode = false;
    }
}

// 辅助函数：显示消息
function showMessage(message, color = '#FFD700') {
    const messageText = document.createElement('div');
    messageText.textContent = message;
    messageText.style.position = 'absolute';
    messageText.style.top = '150px';
    messageText.style.left = '50%';
    messageText.style.transform = 'translateX(-50%)';
    messageText.style.color = color;
    messageText.style.fontSize = '24px';
    messageText.style.fontWeight = 'bold';
    messageText.style.textShadow = '0 0 5px #000';
    messageText.style.zIndex = '100';
    messageText.style.opacity = '1';
    messageText.style.transition = 'opacity 2s, transform 1s';

    document.querySelector('.game-container').appendChild(messageText);

    // 动画效果 - 减短显示时间为1.5秒
    setTimeout(() => {
        messageText.style.opacity = '0';
        messageText.style.transform = 'translateX(-50%) translateY(-50px)';
        setTimeout(() => {
            messageText.remove();
        }, 2000);
    }, 1500); // 从2000改为1500
}

// 游戏开始
function startGame() {
    // 停止任何正在运行的游戏
    if (gameRunning) {
        gameRunning = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (obstacleTimer) {
            clearInterval(obstacleTimer);
            obstacleTimer = null;
        }
    }

    gameRunning = true;
    obstacles = [];
    score = 0;
    consecutivePasses = 0;
    bonusActive = false;
    bonusMultiplier = 1; // 重置奖励倍率
    gameSpeed = baseGameSpeed; // 重置游戏速度
    difficultyLevel = 0; // 重置难度等级
    obstaclesPassed = 0; // 重置通过的障碍物数量
    isNightMode = false; // 重置为白天模式
    dayNightTransition = 0; // 重置昼夜过渡
    scoreElement.textContent = `分数: ${score}`;
    bird.reset();
    
    gameLoop();
    startButton.textContent = '重新开始';

    // 只保留滑翔按键提示
    showMessage('按住Shift键滑翔', '#87CEFA');
    
    // 延迟创建第一个障碍物
    setTimeout(() => {
        createObstacles();
    }, 3000);
}

// 游戏结束
function gameOver() {
    gameRunning = false;
    consecutivePasses = 0;
    bonusActive = false;
    
    // 清除计时器和动画帧
    if (obstacleTimer) {
        clearInterval(obstacleTimer);
        obstacleTimer = null;
    }
    
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // 根据当前是白天还是黑夜选择不同的游戏结束背景颜色
    if (isNightMode || dayNightTransition > 0.5) {
        // 夜晚模式下使用更深的背景
        ctx.fillStyle = 'rgba(0, 0, 30, 0.8)';
    } else {
        // 白天模式
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    }

    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 游戏结束文字颜色
    if (isNightMode) {
        ctx.fillStyle = '#E6E6FA'; // 淡紫色
    } else {
        ctx.fillStyle = 'white';
    }

    ctx.font = '48px Arial';
    ctx.fillText('游戏结束', canvas.width / 2 - 120, canvas.height / 2 - 60);

    ctx.font = '24px Arial';
    ctx.fillText(`最终得分: ${score}${bonusMultiplier > 1 ? ` (x${bonusMultiplier})` : ''}`, canvas.width / 2 - 80, canvas.height / 2);

    // 显示最终难度和通过的障碍物数量
    if (isNightMode) {
        ctx.fillStyle = '#FFA07A'; // 亮珊瑚色
    } else {
        ctx.fillStyle = '#FF9900';
    }

    ctx.fillText(`达到难度: ${difficultyLevel + 1}`, canvas.width / 2 - 80, canvas.height / 2 + 35);
    ctx.fillText(`通过障碍物: ${obstaclesPassed}`, canvas.width / 2 - 80, canvas.height / 2 + 70);

    // 显示挑战提示
    ctx.font = '16px Arial';

    if (isNightMode) {
        ctx.fillStyle = '#98FB98'; // 浅绿色
    } else {
        ctx.fillStyle = '#AAFFAA';
    }

    ctx.fillText('提示: 通过更多障碍物获得更高倍率！最高可达5倍分数', canvas.width / 2 - 200, canvas.height / 2 + 105);
}

// 事件监听
startButton.addEventListener('click', startGame);

// 监听点击和按键事件让小鸟跳跃
canvas.addEventListener('click', () => {
    if (gameRunning) {
        bird.jump();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameRunning) {
        e.preventDefault();
        bird.jump();
    }

    // 按T键切换轨迹预测
    if (e.code === 'KeyT' && gameRunning) {
        bird.showTrajectory = !bird.showTrajectory;
        // 轨迹预测开关提示已移除
    }

    // 按住Shift键开始滑翔
    if (e.code === 'ShiftLeft' && gameRunning) {
        bird.startGliding();
    }
});

// 添加松开Shift键结束滑翔
document.addEventListener('keyup', (e) => {
    if (e.code === 'ShiftLeft' && gameRunning) {
        bird.stopGliding();
    }
});