'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_SKILL_TIMEOUT_MS = 5 * 60 * 1000;
const DEEP_RESEARCH_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const MAX_PROGRESS_BYTES = 100 * 1024 * 1024;

function getSkillExecutionTimeoutMs(skillName) {
    return skillName === 'deep_research' ? DEEP_RESEARCH_TIMEOUT_MS : DEFAULT_SKILL_TIMEOUT_MS;
}

function publicInterruptionMessage(code) {
    if (code === 'PYTHON_TIMEOUT') {
        return 'La investigación alcanzó el límite máximo de ejecución. El último checkpoint puede retomarse.';
    }
    if (code === 'PYTHON_ABORTED') {
        return 'La investigación fue cancelada. El último checkpoint puede retomarse.';
    }
    if (code === 'PYTHON_OUTPUT_LIMIT') {
        return 'La investigación superó el límite de salida del proceso. El último checkpoint puede retomarse.';
    }
    return 'El proceso de investigación terminó antes de completar el paso actual. El último checkpoint puede retomarse.';
}

function markDeepResearchInterrupted(workspaceRoot, executionArgs, error) {
    if (typeof workspaceRoot !== 'string' || !workspaceRoot || !executionArgs || typeof executionArgs !== 'object') return false;
    const sessionId = String(executionArgs._session_id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
    if (!sessionId) return false;

    const progressDir = path.resolve(workspaceRoot, 'sessions', 'deep_research');
    const progressPath = path.resolve(progressDir, `.deep_research_progress_${sessionId}.json`);
    if (path.dirname(progressPath) !== progressDir || !fs.existsSync(progressPath)) return false;

    try {
        const stat = fs.statSync(progressPath);
        if (!stat.isFile() || stat.size > MAX_PROGRESS_BYTES) return false;
        const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
        const checkpoint = progress?.checkpoint;
        if (!checkpoint || typeof checkpoint !== 'object' || checkpoint.phase === 'completed' || progress.status === 'completed') return false;
        if (String(checkpoint.session_id || '') !== String(executionArgs._session_id || '')) return false;
        if (typeof executionArgs.topic === 'string' && executionArgs.topic && checkpoint.topic !== executionArgs.topic) return false;

        const code = typeof error?.code === 'string' ? error.code : 'PYTHON_EXIT';
        const message = publicInterruptionMessage(code);
        progress.status = 'failed';
        progress.stage = 'Ejecución interrumpida';
        progress.resume_available = true;
        progress.error_code = code;
        progress.error = message;
        progress.last_updated = Date.now() / 1000;
        if (!Array.isArray(progress.timeline)) progress.timeline = [];
        const timestamp = new Date().toLocaleTimeString('es-MX', { hour12: false });
        progress.timeline.push(`[${timestamp}] ${message}`);

        const tempPath = `${progressPath}.${process.pid}.${Date.now()}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(progress, null, 2), { encoding: 'utf8', flag: 'wx' });
        fs.renameSync(tempPath, progressPath);
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    DEFAULT_SKILL_TIMEOUT_MS,
    DEEP_RESEARCH_TIMEOUT_MS,
    getSkillExecutionTimeoutMs,
    markDeepResearchInterrupted,
};

