/**
 * @file 2026 FIFA 世界杯静态数据模块
 * @description 提供 2026 年 FIFA 世界杯的参赛队伍、比赛场馆、赛程安排等静态数据，
 *              以及基于这些数据构建的查找索引和辅助工具函数。
 */

/**
 * 世界杯核心数据
 * @property {Array<Object>} teams   - 参赛队伍列表
 * @property {Array<Object>} venues  - 比赛场馆列表
 * @property {Array<Object>} matches - 全部赛程列表
 */
const WORLD_CUP_DATA = {
    // 队伍对象结构: { id: string, name: string, group: string, flag: string }
    teams: [
        { id: 'MEX', name: '墨西哥', group: 'A', rank: 18, flag: 'https://flagcdn.com/40x30/mx.png' },
        { id: 'RSA', name: '南非', group: 'A', rank: 58, flag: 'https://flagcdn.com/40x30/za.png' },
        { id: 'KOR', name: '韩国', group: 'A', rank: 23, flag: 'https://flagcdn.com/40x30/kr.png' },
        { id: 'CZE', name: '捷克', group: 'A', rank: 36, flag: 'https://flagcdn.com/40x30/cz.png' },
        { id: 'CAN', name: '加拿大', group: 'B', rank: 31, flag: 'https://flagcdn.com/40x30/ca.png' },
        { id: 'BIH', name: '波黑', group: 'B', rank: 62, flag: 'https://flagcdn.com/40x30/ba.png' },
        { id: 'QAT', name: '卡塔尔', group: 'B', rank: 34, flag: 'https://flagcdn.com/40x30/qa.png' },
        { id: 'SUI', name: '瑞士', group: 'B', rank: 15, flag: 'https://flagcdn.com/40x30/ch.png' },
        { id: 'BRA', name: '巴西', group: 'C', rank: 5, flag: 'https://flagcdn.com/40x30/br.png' },
        { id: 'MAR', name: '摩洛哥', group: 'C', rank: 14, flag: 'https://flagcdn.com/40x30/ma.png' },
        { id: 'HAI', name: '海地', group: 'C', rank: 72, flag: 'https://flagcdn.com/40x30/ht.png' },
        { id: 'SCO', name: '苏格兰', group: 'C', rank: 42, flag: 'https://flagcdn.com/40x30/gb-sct.png' },
        { id: 'USA', name: '美国', group: 'D', rank: 16, flag: 'https://flagcdn.com/40x30/us.png' },
        { id: 'PAR', name: '巴拉圭', group: 'D', rank: 52, flag: 'https://flagcdn.com/40x30/py.png' },
        { id: 'AUS', name: '澳大利亚', group: 'D', rank: 25, flag: 'https://flagcdn.com/40x30/au.png' },
        { id: 'TUR', name: '土耳其', group: 'D', rank: 26, flag: 'https://flagcdn.com/40x30/tr.png' },
        { id: 'GER', name: '德国', group: 'E', rank: 7, flag: 'https://flagcdn.com/40x30/de.png' },
        { id: 'CUW', name: '库拉索', group: 'E', rank: 148, flag: 'https://flagcdn.com/40x30/cw.png' },
        { id: 'CIV', name: '科特迪瓦', group: 'E', rank: 37, flag: 'https://flagcdn.com/40x30/ci.png' },
        { id: 'ECU', name: '厄瓜多尔', group: 'E', rank: 27, flag: 'https://flagcdn.com/40x30/ec.png' },
        { id: 'NED', name: '荷兰', group: 'F', rank: 8, flag: 'https://flagcdn.com/40x30/nl.png' },
        { id: 'JPN', name: '日本', group: 'F', rank: 17, flag: 'https://flagcdn.com/40x30/jp.png' },
        { id: 'SWE', name: '瑞典', group: 'F', rank: 28, flag: 'https://flagcdn.com/40x30/se.png' },
        { id: 'TUN', name: '突尼斯', group: 'F', rank: 41, flag: 'https://flagcdn.com/40x30/tn.png' },
        { id: 'BEL', name: '比利时', group: 'G', rank: 6, flag: 'https://flagcdn.com/40x30/be.png' },
        { id: 'EGY', name: '埃及', group: 'G', rank: 38, flag: 'https://flagcdn.com/40x30/eg.png' },
        { id: 'IRN', name: '伊朗', group: 'G', rank: 19, flag: 'https://flagcdn.com/40x30/ir.png' },
        { id: 'NZL', name: '新西兰', group: 'G', rank: 55, flag: 'https://flagcdn.com/40x30/nz.png' },
        { id: 'ESP', name: '西班牙', group: 'H', rank: 3, flag: 'https://flagcdn.com/40x30/es.png' },
        { id: 'CPV', name: '佛得角', group: 'H', rank: 67, flag: 'https://flagcdn.com/40x30/cv.png' },
        { id: 'KSA', name: '沙特阿拉伯', group: 'H', rank: 53, flag: 'https://flagcdn.com/40x30/sa.png' },
        { id: 'URU', name: '乌拉圭', group: 'H', rank: 13, flag: 'https://flagcdn.com/40x30/uy.png' },
        { id: 'FRA', name: '法国', group: 'I', rank: 2, flag: 'https://flagcdn.com/40x30/fr.png' },
        { id: 'SEN', name: '塞内加尔', group: 'I', rank: 20, flag: 'https://flagcdn.com/40x30/sn.png' },
        { id: 'IRQ', name: '伊拉克', group: 'I', rank: 56, flag: 'https://flagcdn.com/40x30/iq.png' },
        { id: 'NOR', name: '挪威', group: 'I', rank: 43, flag: 'https://flagcdn.com/40x30/no.png' },
        { id: 'ARG', name: '阿根廷', group: 'J', rank: 1, flag: 'https://flagcdn.com/40x30/ar.png' },
        { id: 'ALG', name: '阿尔及利亚', group: 'J', rank: 33, flag: 'https://flagcdn.com/40x30/dz.png' },
        { id: 'AUT', name: '奥地利', group: 'J', rank: 22, flag: 'https://flagcdn.com/40x30/at.png' },
        { id: 'JOR', name: '约旦', group: 'J', rank: 68, flag: 'https://flagcdn.com/40x30/jo.png' },
        { id: 'POR', name: '葡萄牙', group: 'K', rank: 9, flag: 'https://flagcdn.com/40x30/pt.png' },
        { id: 'COD', name: '刚果(金)', group: 'K', rank: 46, flag: 'https://flagcdn.com/40x30/cd.png' },
        { id: 'UZB', name: '乌兹别克斯坦', group: 'K', rank: 57, flag: 'https://flagcdn.com/40x30/uz.png' },
        { id: 'COL', name: '哥伦比亚', group: 'K', rank: 10, flag: 'https://flagcdn.com/40x30/co.png' },
        { id: 'ENG', name: '英格兰', group: 'L', rank: 4, flag: 'https://flagcdn.com/40x30/gb-eng.png' },
        { id: 'CRO', name: '克罗地亚', group: 'L', rank: 11, flag: 'https://flagcdn.com/40x30/hr.png' },
        { id: 'GHA', name: '加纳', group: 'L', rank: 47, flag: 'https://flagcdn.com/40x30/gh.png' },
        { id: 'PAN', name: '巴拿马', group: 'L', rank: 45, flag: 'https://flagcdn.com/40x30/pa.png' }
    ],

    // 场馆对象结构: { id: string, name: string, city: string, country: string, capacity: number }
    venues: [
        { id: '4727', name: 'MetLife Stadium', city: '纽约', country: '美国', capacity: 82500 },
        { id: '9115', name: 'SoFi Stadium', city: '洛杉矶', country: '美国', capacity: 100240 },
        { id: '3871', name: 'AT&T Stadium', city: '达拉斯', country: '美国', capacity: 80000 },
        { id: '7485', name: 'Mercedes-Benz Stadium', city: '亚特兰大', country: '美国', capacity: 71000 },
        { id: '6262', name: 'NRG Stadium', city: '休斯顿', country: '美国', capacity: 72220 },
        { id: '10897', name: 'GEHA Field at Arrowhead Stadium', city: '堪萨斯城', country: '美国', capacity: 76416 },
        { id: '5960', name: "Levi's Stadium", city: '旧金山', country: '美国', capacity: 75000 },
        { id: '4485', name: 'Lumen Field', city: '西雅图', country: '美国', capacity: 72000 },
        { id: '1421', name: 'Lincoln Financial Field', city: '费城', country: '美国', capacity: 69328 },
        { id: '10660', name: 'Gillette Stadium', city: '波士顿', country: '美国', capacity: 65878 },
        { id: '4643', name: 'Hard Rock Stadium', city: '迈阿密', country: '美国', capacity: 65326 },
        { id: '10143', name: 'BMO Field', city: '多伦多', country: '加拿大', capacity: 45000 },
        { id: '4370', name: 'BC Place', city: '温哥华', country: '加拿大', capacity: 54500 },
        { id: '1672', name: 'Estadio Banorte', city: '墨西哥城', country: '墨西哥', capacity: 87000 },
        { id: '5009', name: 'Estadio Akron', city: '瓜达拉哈拉', country: '墨西哥', capacity: 49850 },
        { id: '6351', name: 'Estadio BBVA', city: '蒙特雷', country: '墨西哥', capacity: 51000 }
    ],

    // 比赛对象结构: { id: number, date: string, time: string, homeTeam: string, awayTeam: string, venue: string, stage: string, group: string|null, status: string }
    matches: [
        // ========== 小组赛 (72场) ==========
        // 第1比赛日 6月11日
        {
            id: 1,
            date: '2026-06-11',
            time: '13:00',
            homeTeam: 'MEX',
            awayTeam: 'RSA',
            venue: '1672',
            stage: 'group',
            group: 'A',
            status: 'scheduled'
        },
        {
            id: 2,
            date: '2026-06-11',
            time: '21:00',
            homeTeam: 'KOR',
            awayTeam: 'CZE',
            venue: '5009',
            stage: 'group',
            group: 'A',
            status: 'scheduled'
        },
        // 第2比赛日 6月12日
        {
            id: 3,
            date: '2026-06-12',
            time: '14:00',
            homeTeam: 'CAN',
            awayTeam: 'BIH',
            venue: '10143',
            stage: 'group',
            group: 'B',
            status: 'scheduled'
        },
        {
            id: 4,
            date: '2026-06-12',
            time: '18:00',
            homeTeam: 'USA',
            awayTeam: 'PAR',
            venue: '9115',
            stage: 'group',
            group: 'D',
            status: 'scheduled'
        },
        // 第3比赛日 6月13日
        {
            id: 5,
            date: '2026-06-13',
            time: '03:00',
            homeTeam: 'QAT',
            awayTeam: 'SUI',
            venue: '5960',
            stage: 'group',
            group: 'B',
            status: 'scheduled'
        },
        {
            id: 6,
            date: '2026-06-13',
            time: '18:00',
            homeTeam: 'BRA',
            awayTeam: 'MAR',
            venue: '4727',
            stage: 'group',
            group: 'C',
            status: 'scheduled'
        },
        {
            id: 7,
            date: '2026-06-13',
            time: '21:00',
            homeTeam: 'HAI',
            awayTeam: 'SCO',
            venue: '10660',
            stage: 'group',
            group: 'C',
            status: 'scheduled'
        },
        {
            id: 8,
            date: '2026-06-13',
            time: '23:00',
            homeTeam: 'AUS',
            awayTeam: 'TUR',
            venue: '4370',
            stage: 'group',
            group: 'D',
            status: 'scheduled'
        },
        // 第4比赛日 6月14日
        {
            id: 9,
            date: '2026-06-14',
            time: '12:00',
            homeTeam: 'GER',
            awayTeam: 'CUW',
            venue: '6262',
            stage: 'group',
            group: 'E',
            status: 'scheduled'
        },
        {
            id: 10,
            date: '2026-06-14',
            time: '15:00',
            homeTeam: 'NED',
            awayTeam: 'JPN',
            venue: '3871',
            stage: 'group',
            group: 'F',
            status: 'scheduled'
        },
        {
            id: 11,
            date: '2026-06-14',
            time: '19:00',
            homeTeam: 'CIV',
            awayTeam: 'ECU',
            venue: '1421',
            stage: 'group',
            group: 'E',
            status: 'scheduled'
        },
        {
            id: 12,
            date: '2026-06-14',
            time: '22:00',
            homeTeam: 'SWE',
            awayTeam: 'TUN',
            venue: '6351',
            stage: 'group',
            group: 'F',
            status: 'scheduled'
        },
        // 第5比赛日 6月15日
        {
            id: 13,
            date: '2026-06-15',
            time: '05:00',
            homeTeam: 'ESP',
            awayTeam: 'CPV',
            venue: '7485',
            stage: 'group',
            group: 'H',
            status: 'scheduled'
        },
        {
            id: 14,
            date: '2026-06-15',
            time: '08:00',
            homeTeam: 'BEL',
            awayTeam: 'EGY',
            venue: '4485',
            stage: 'group',
            group: 'G',
            status: 'scheduled'
        },
        {
            id: 15,
            date: '2026-06-15',
            time: '11:00',
            homeTeam: 'KSA',
            awayTeam: 'URU',
            venue: '4643',
            stage: 'group',
            group: 'H',
            status: 'scheduled'
        },
        {
            id: 16,
            date: '2026-06-15',
            time: '18:00',
            homeTeam: 'IRN',
            awayTeam: 'NZL',
            venue: '9115',
            stage: 'group',
            group: 'G',
            status: 'scheduled'
        },
        // 第6比赛日 6月16日
        {
            id: 17,
            date: '2026-06-16',
            time: '07:00',
            homeTeam: 'FRA',
            awayTeam: 'SEN',
            venue: '4727',
            stage: 'group',
            group: 'I',
            status: 'scheduled'
        },
        {
            id: 18,
            date: '2026-06-16',
            time: '10:00',
            homeTeam: 'IRQ',
            awayTeam: 'NOR',
            venue: '10660',
            stage: 'group',
            group: 'I',
            status: 'scheduled'
        },
        {
            id: 19,
            date: '2026-06-16',
            time: '13:00',
            homeTeam: 'ARG',
            awayTeam: 'ALG',
            venue: '10897',
            stage: 'group',
            group: 'J',
            status: 'scheduled'
        },
        {
            id: 20,
            date: '2026-06-16',
            time: '16:00',
            homeTeam: 'AUT',
            awayTeam: 'JOR',
            venue: '5960',
            stage: 'group',
            group: 'J',
            status: 'scheduled'
        },
        // 第7比赛日 6月17日
        {
            id: 21,
            date: '2026-06-17',
            time: '05:00',
            homeTeam: 'POR',
            awayTeam: 'COD',
            venue: '6262',
            stage: 'group',
            group: 'K',
            status: 'scheduled'
        },
        {
            id: 22,
            date: '2026-06-17',
            time: '08:00',
            homeTeam: 'ENG',
            awayTeam: 'CRO',
            venue: '3871',
            stage: 'group',
            group: 'L',
            status: 'scheduled'
        },
        {
            id: 23,
            date: '2026-06-17',
            time: '11:00',
            homeTeam: 'GHA',
            awayTeam: 'PAN',
            venue: '10143',
            stage: 'group',
            group: 'L',
            status: 'scheduled'
        },
        {
            id: 24,
            date: '2026-06-17',
            time: '14:00',
            homeTeam: 'UZB',
            awayTeam: 'COL',
            venue: '1672',
            stage: 'group',
            group: 'K',
            status: 'scheduled'
        },
        // 第8比赛日 6月18日
        {
            id: 25,
            date: '2026-06-18',
            time: '02:00',
            homeTeam: 'CZE',
            awayTeam: 'RSA',
            venue: '7485',
            stage: 'group',
            group: 'A',
            status: 'scheduled'
        },
        {
            id: 26,
            date: '2026-06-18',
            time: '03:00',
            homeTeam: 'SUI',
            awayTeam: 'BIH',
            venue: '9115',
            stage: 'group',
            group: 'B',
            status: 'scheduled'
        },
        {
            id: 27,
            date: '2026-06-18',
            time: '06:00',
            homeTeam: 'CAN',
            awayTeam: 'QAT',
            venue: '4370',
            stage: 'group',
            group: 'B',
            status: 'scheduled'
        },
        {
            id: 28,
            date: '2026-06-18',
            time: '10:00',
            homeTeam: 'MEX',
            awayTeam: 'KOR',
            venue: '6262',
            stage: 'group',
            group: 'A',
            status: 'scheduled'
        },
        // 第9比赛日 6月19日
        {
            id: 29,
            date: '2026-06-19',
            time: '01:00',
            homeTeam: 'USA',
            awayTeam: 'AUS',
            venue: '4485',
            stage: 'group',
            group: 'D',
            status: 'scheduled'
        },
        {
            id: 30,
            date: '2026-06-19',
            time: '06:00',
            homeTeam: 'SCO',
            awayTeam: 'MAR',
            venue: '10660',
            stage: 'group',
            group: 'C',
            status: 'scheduled'
        },
        {
            id: 31,
            date: '2026-06-19',
            time: '09:30',
            homeTeam: 'BRA',
            awayTeam: 'HAI',
            venue: '1421',
            stage: 'group',
            group: 'C',
            status: 'scheduled'
        },
        {
            id: 32,
            date: '2026-06-19',
            time: '12:00',
            homeTeam: 'TUR',
            awayTeam: 'PAR',
            venue: '5960',
            stage: 'group',
            group: 'D',
            status: 'scheduled'
        },
        // 第10比赛日 6月20日
        {
            id: 33,
            date: '2026-06-20',
            time: '01:00',
            homeTeam: 'NED',
            awayTeam: 'SWE',
            venue: '6262',
            stage: 'group',
            group: 'F',
            status: 'scheduled'
        },
        {
            id: 34,
            date: '2026-06-20',
            time: '04:00',
            homeTeam: 'GER',
            awayTeam: 'CIV',
            venue: '10143',
            stage: 'group',
            group: 'E',
            status: 'scheduled'
        },
        {
            id: 35,
            date: '2026-06-20',
            time: '10:00',
            homeTeam: 'ECU',
            awayTeam: 'CUW',
            venue: '4727',
            stage: 'group',
            group: 'E',
            status: 'scheduled'
        },
        {
            id: 36,
            date: '2026-06-20',
            time: '12:00',
            homeTeam: 'TUN',
            awayTeam: 'JPN',
            venue: '6351',
            stage: 'group',
            group: 'F',
            status: 'scheduled'
        },
        // 第11比赛日 6月21日
        {
            id: 37,
            date: '2026-06-21',
            time: '00:00',
            homeTeam: 'ESP',
            awayTeam: 'KSA',
            venue: '7485',
            stage: 'group',
            group: 'H',
            status: 'scheduled'
        },
        {
            id: 38,
            date: '2026-06-21',
            time: '03:00',
            homeTeam: 'BEL',
            awayTeam: 'IRN',
            venue: '9115',
            stage: 'group',
            group: 'G',
            status: 'scheduled'
        },
        {
            id: 39,
            date: '2026-06-21',
            time: '06:00',
            homeTeam: 'URU',
            awayTeam: 'CPV',
            venue: '4643',
            stage: 'group',
            group: 'H',
            status: 'scheduled'
        },
        {
            id: 40,
            date: '2026-06-21',
            time: '10:00',
            homeTeam: 'NZL',
            awayTeam: 'EGY',
            venue: '4370',
            stage: 'group',
            group: 'G',
            status: 'scheduled'
        },
        // 第12比赛日 6月22日
        {
            id: 41,
            date: '2026-06-22',
            time: '01:00',
            homeTeam: 'ARG',
            awayTeam: 'AUT',
            venue: '3871',
            stage: 'group',
            group: 'J',
            status: 'scheduled'
        },
        {
            id: 42,
            date: '2026-06-22',
            time: '05:00',
            homeTeam: 'FRA',
            awayTeam: 'IRQ',
            venue: '1421',
            stage: 'group',
            group: 'I',
            status: 'scheduled'
        },
        {
            id: 43,
            date: '2026-06-22',
            time: '08:00',
            homeTeam: 'NOR',
            awayTeam: 'SEN',
            venue: '4727',
            stage: 'group',
            group: 'I',
            status: 'scheduled'
        },
        {
            id: 44,
            date: '2026-06-22',
            time: '11:00',
            homeTeam: 'JOR',
            awayTeam: 'ALG',
            venue: '5960',
            stage: 'group',
            group: 'J',
            status: 'scheduled'
        },
        // 第13比赛日 6月23日
        {
            id: 45,
            date: '2026-06-23',
            time: '01:00',
            homeTeam: 'POR',
            awayTeam: 'UZB',
            venue: '6262',
            stage: 'group',
            group: 'K',
            status: 'scheduled'
        },
        {
            id: 46,
            date: '2026-06-23',
            time: '04:00',
            homeTeam: 'ENG',
            awayTeam: 'GHA',
            venue: '10660',
            stage: 'group',
            group: 'L',
            status: 'scheduled'
        },
        {
            id: 47,
            date: '2026-06-23',
            time: '07:00',
            homeTeam: 'PAN',
            awayTeam: 'CRO',
            venue: '10143',
            stage: 'group',
            group: 'L',
            status: 'scheduled'
        },
        {
            id: 48,
            date: '2026-06-23',
            time: '10:00',
            homeTeam: 'COL',
            awayTeam: 'COD',
            venue: '1672',
            stage: 'group',
            group: 'K',
            status: 'scheduled'
        },
        // 第14比赛日 6月24日
        {
            id: 49,
            date: '2026-06-24',
            time: '03:00',
            homeTeam: 'SUI',
            awayTeam: 'CAN',
            venue: '4370',
            stage: 'group',
            group: 'B',
            status: 'scheduled'
        },
        {
            id: 50,
            date: '2026-06-24',
            time: '03:00',
            homeTeam: 'BIH',
            awayTeam: 'QAT',
            venue: '4485',
            stage: 'group',
            group: 'B',
            status: 'scheduled'
        },
        {
            id: 51,
            date: '2026-06-24',
            time: '06:00',
            homeTeam: 'MAR',
            awayTeam: 'HAI',
            venue: '7485',
            stage: 'group',
            group: 'C',
            status: 'scheduled'
        },
        {
            id: 52,
            date: '2026-06-24',
            time: '06:00',
            homeTeam: 'SCO',
            awayTeam: 'BRA',
            venue: '4643',
            stage: 'group',
            group: 'C',
            status: 'scheduled'
        },
        {
            id: 53,
            date: '2026-06-24',
            time: '10:00',
            homeTeam: 'CZE',
            awayTeam: 'MEX',
            venue: '1672',
            stage: 'group',
            group: 'A',
            status: 'scheduled'
        },
        {
            id: 54,
            date: '2026-06-24',
            time: '10:00',
            homeTeam: 'RSA',
            awayTeam: 'KOR',
            venue: '6351',
            stage: 'group',
            group: 'A',
            status: 'scheduled'
        },
        // 第15比赛日 6月25日
        {
            id: 55,
            date: '2026-06-25',
            time: '04:00',
            homeTeam: 'ECU',
            awayTeam: 'GER',
            venue: '4727',
            stage: 'group',
            group: 'E',
            status: 'scheduled'
        },
        {
            id: 56,
            date: '2026-06-25',
            time: '04:00',
            homeTeam: 'CUW',
            awayTeam: 'CIV',
            venue: '1421',
            stage: 'group',
            group: 'E',
            status: 'scheduled'
        },
        {
            id: 57,
            date: '2026-06-25',
            time: '07:00',
            homeTeam: 'TUN',
            awayTeam: 'NED',
            venue: '3871',
            stage: 'group',
            group: 'F',
            status: 'scheduled'
        },
        {
            id: 58,
            date: '2026-06-25',
            time: '07:00',
            homeTeam: 'JPN',
            awayTeam: 'SWE',
            venue: '10897',
            stage: 'group',
            group: 'F',
            status: 'scheduled'
        },
        {
            id: 59,
            date: '2026-06-25',
            time: '10:00',
            homeTeam: 'TUR',
            awayTeam: 'USA',
            venue: '9115',
            stage: 'group',
            group: 'D',
            status: 'scheduled'
        },
        {
            id: 60,
            date: '2026-06-25',
            time: '10:00',
            homeTeam: 'PAR',
            awayTeam: 'AUS',
            venue: '5960',
            stage: 'group',
            group: 'D',
            status: 'scheduled'
        },
        // 第16比赛日 6月26日
        {
            id: 61,
            date: '2026-06-26',
            time: '03:00',
            homeTeam: 'NOR',
            awayTeam: 'FRA',
            venue: '4727',
            stage: 'group',
            group: 'I',
            status: 'scheduled'
        },
        {
            id: 62,
            date: '2026-06-26',
            time: '03:00',
            homeTeam: 'SEN',
            awayTeam: 'IRQ',
            venue: '7485',
            stage: 'group',
            group: 'I',
            status: 'scheduled'
        },
        {
            id: 63,
            date: '2026-06-26',
            time: '08:00',
            homeTeam: 'URU',
            awayTeam: 'ESP',
            venue: '4643',
            stage: 'group',
            group: 'H',
            status: 'scheduled'
        },
        {
            id: 64,
            date: '2026-06-26',
            time: '08:00',
            homeTeam: 'CPV',
            awayTeam: 'KSA',
            venue: '10897',
            stage: 'group',
            group: 'H',
            status: 'scheduled'
        },
        {
            id: 65,
            date: '2026-06-26',
            time: '11:00',
            homeTeam: 'NZL',
            awayTeam: 'BEL',
            venue: '4370',
            stage: 'group',
            group: 'G',
            status: 'scheduled'
        },
        {
            id: 66,
            date: '2026-06-26',
            time: '11:00',
            homeTeam: 'EGY',
            awayTeam: 'IRN',
            venue: '4485',
            stage: 'group',
            group: 'G',
            status: 'scheduled'
        },
        // 第17比赛日 6月27日（小组赛收官）
        {
            id: 67,
            date: '2026-06-27',
            time: '05:00',
            homeTeam: 'PAN',
            awayTeam: 'ENG',
            venue: '4727',
            stage: 'group',
            group: 'L',
            status: 'scheduled'
        },
        {
            id: 68,
            date: '2026-06-27',
            time: '05:00',
            homeTeam: 'CRO',
            awayTeam: 'GHA',
            venue: '4643',
            stage: 'group',
            group: 'L',
            status: 'scheduled'
        },
        {
            id: 69,
            date: '2026-06-27',
            time: '07:30',
            homeTeam: 'COL',
            awayTeam: 'POR',
            venue: '3871',
            stage: 'group',
            group: 'K',
            status: 'scheduled'
        },
        {
            id: 70,
            date: '2026-06-27',
            time: '07:30',
            homeTeam: 'COD',
            awayTeam: 'UZB',
            venue: '1421',
            stage: 'group',
            group: 'K',
            status: 'scheduled'
        },
        {
            id: 71,
            date: '2026-06-27',
            time: '10:00',
            homeTeam: 'JOR',
            awayTeam: 'ARG',
            venue: '10897',
            stage: 'group',
            group: 'J',
            status: 'scheduled'
        },
        {
            id: 72,
            date: '2026-06-27',
            time: '10:00',
            homeTeam: 'ALG',
            awayTeam: 'AUT',
            venue: '5960',
            stage: 'group',
            group: 'J',
            status: 'scheduled'
        },

        // ========== 32强淘汰赛 (16场) 6月28日 - 7月3日 ==========
        {
            id: 73,
            date: '2026-06-28',
            time: '14:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '4727',
            stage: 'round32',
            group: null,
            status: 'scheduled'
        },
        {
            id: 74,
            date: '2026-06-29',
            time: '10:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '9115',
            stage: 'round32',
            group: null,
            status: 'scheduled'
        },
        {
            id: 75,
            date: '2026-06-29',
            time: '13:30',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '10897',
            stage: 'round32',
            group: null,
            status: 'scheduled'
        },
        {
            id: 76,
            date: '2026-06-29',
            time: '18:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '3871',
            stage: 'round32',
            group: null,
            status: 'scheduled'
        },
        {
            id: 77,
            date: '2026-06-30',
            time: '10:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '5960',
            stage: 'round32',
            group: null,
            status: 'scheduled'
        },
        {
            id: 78,
            date: '2026-06-30',
            time: '14:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '7485',
            stage: 'round32',
            group: null,
            status: 'scheduled'
        },
        {
            id: 79,
            date: '2026-06-30',
            time: '18:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '6262',
            stage: 'round32',
            group: null,
            status: 'scheduled'
        },
        {
            id: 80,
            date: '2026-07-01',
            time: '09:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '10660',
            stage: 'round32',
            group: null,
            status: 'scheduled'
        },
        {
            id: 81,
            date: '2026-07-01',
            time: '13:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '4485',
            stage: 'round32',
            group: null,
            status: 'scheduled'
        },
        {
            id: 82,
            date: '2026-07-02',
            time: '09:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '4643',
            stage: 'round32',
            group: null,
            status: 'scheduled'
        },
        {
            id: 83,
            date: '2026-07-02',
            time: '13:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '10143',
            stage: 'round32',
            group: null,
            status: 'scheduled'
        },
        {
            id: 84,
            date: '2026-07-03',
            time: '08:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '1672',
            stage: 'round32',
            group: null,
            status: 'scheduled'
        },
        {
            id: 85,
            date: '2026-07-03',
            time: '12:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '5009',
            stage: 'round32',
            group: null,
            status: 'scheduled'
        },
        {
            id: 86,
            date: '2026-07-03',
            time: '18:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '6351',
            stage: 'round32',
            group: null,
            status: 'scheduled'
        },
        {
            id: 87,
            date: '2026-07-04',
            time: '07:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '4370',
            stage: 'round32',
            group: null,
            status: 'scheduled'
        },
        {
            id: 88,
            date: '2026-07-04',
            time: '11:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '1421',
            stage: 'round32',
            group: null,
            status: 'scheduled'
        },

        // ========== 16强淘汰赛 (8场) 7月5日 - 7月8日 ==========
        {
            id: 89,
            date: '2026-07-05',
            time: '10:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '9115',
            stage: 'round16',
            group: null,
            status: 'scheduled'
        },
        {
            id: 90,
            date: '2026-07-05',
            time: '14:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '10897',
            stage: 'round16',
            group: null,
            status: 'scheduled'
        },
        {
            id: 91,
            date: '2026-07-06',
            time: '10:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '5960',
            stage: 'round16',
            group: null,
            status: 'scheduled'
        },
        {
            id: 92,
            date: '2026-07-06',
            time: '14:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '7485',
            stage: 'round16',
            group: null,
            status: 'scheduled'
        },
        {
            id: 93,
            date: '2026-07-07',
            time: '09:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '6262',
            stage: 'round16',
            group: null,
            status: 'scheduled'
        },
        {
            id: 94,
            date: '2026-07-07',
            time: '14:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '4643',
            stage: 'round16',
            group: null,
            status: 'scheduled'
        },
        {
            id: 95,
            date: '2026-07-08',
            time: '09:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '10143',
            stage: 'round16',
            group: null,
            status: 'scheduled'
        },
        {
            id: 96,
            date: '2026-07-08',
            time: '13:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '4485',
            stage: 'round16',
            group: null,
            status: 'scheduled'
        },

        // ========== 1/4决赛 (4场) 7月10日 - 7月12日 ==========
        {
            id: 97,
            date: '2026-07-10',
            time: '13:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '10660',
            stage: 'quarterfinal',
            group: null,
            status: 'scheduled'
        },
        {
            id: 98,
            date: '2026-07-11',
            time: '12:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '9115',
            stage: 'quarterfinal',
            group: null,
            status: 'scheduled'
        },
        {
            id: 99,
            date: '2026-07-12',
            time: '14:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '4643',
            stage: 'quarterfinal',
            group: null,
            status: 'scheduled'
        },
        {
            id: 100,
            date: '2026-07-12',
            time: '18:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '10897',
            stage: 'quarterfinal',
            group: null,
            status: 'scheduled'
        },

        // ========== 半决赛 (2场) 7月15日 - 7月16日 ==========
        {
            id: 101,
            date: '2026-07-15',
            time: '14:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '3871',
            stage: 'semifinal',
            group: null,
            status: 'scheduled'
        },
        {
            id: 102,
            date: '2026-07-16',
            time: '15:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '7485',
            stage: 'semifinal',
            group: null,
            status: 'scheduled'
        },

        // ========== 三四名决赛 (1场) 7月19日 ==========
        {
            id: 103,
            date: '2026-07-19',
            time: '17:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '4643',
            stage: 'thirdplace',
            group: null,
            status: 'scheduled'
        },

        // ========== 决赛 (1场) 7月19日 ==========
        {
            id: 104,
            date: '2026-07-19',
            time: '15:00',
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            venue: '4727',
            stage: 'final',
            group: null,
            status: 'scheduled'
        }
    ]
};

/**
 * 根据队伍 ID 查找队伍信息，未找到时返回兜底对象
 * @param {string} teamId       - 队伍 ID（如 'BRA'）
 * @param {string} [fallbackName] - 兜底显示名称（来自 ESPN 等外部数据源）
 * @returns {Object} 队伍对象，包含 name、flag、code 字段
 */
function getTeamById(teamId, fallbackName) {
    const team = WORLD_CUP_DATA.teams.find(team => team.id === teamId);
    if (team) return team;
    // 外部数据源提供的名称作为兜底
    const name = fallbackName || teamId;
    return { name: name, flag: '', code: teamId };
}

/**
 * 根据场馆 ID 查找场馆信息
 * @param {string} venueId - 场馆 ID
 * @returns {Object} 场馆对象，包含 name、city、capacity 字段
 */
function getVenueById(venueId) {
    return WORLD_CUP_DATA.venues.find(venue => venue.id === venueId) || { name: venueId, city: '', capacity: 0 };
}

/**
 * 获取比赛阶段的中文显示名称
 * @param {string} stage - 阶段标识（如 'group'、'round16'、'final'）
 * @returns {string} 阶段中文名称
 */
function getStageName(stage) {
    var stageNames = window.CONFIG.STAGE_NAMES;
    return stageNames[stage] || stage;
}

/**
 * 获取比赛状态的中文显示文本
 * @param {string} status - 状态标识（如 'scheduled'、'live'、'finished'）
 * @returns {string} 状态中文文本
 */
function getStatusText(status) {
    var statusNames = window.CONFIG.STATUS_NAMES;
    return statusNames[status] || status;
}

/**
 * 获取场馆所在时区信息
 * @param {string} venueId - 场馆 ID
 * @returns {Object} 时区信息，包含 offset（UTC 偏移小时数）、name（时区缩写）、city（城市名）
 */
function getVenueTimezone(venueId) {
    var venueTimeZones = window.CONFIG.VENUE_TIMEZONES;
    var fallback = window.CONFIG.VENUE_TIMEZONE_FALLBACK;
    return venueTimeZones[venueId] || fallback;
}

/**
 * 将 Date 对象格式化为中文完整日期字符串
 * @param {Date} date - 日期对象
 * @returns {string} 格式化后的中文日期，如 "2026年6月11日星期四"
 */
function formatDate(date) {
    var options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    return date.toLocaleDateString('zh-CN', options);
}

/**
 * 根据已完赛的小组赛结果计算各组积分排名
 * @param {Array<Object>} [matchesData] - 比赛数据数组，不传则使用本地 WORLD_CUP_DATA.matches
 * @returns {Object} 各组排名，键为小组名（'A'-'L'），值为按规则排序的队伍积分数组
 */
function calculateStandings(matchesData) {
    const standings = {};
    // 优先使用传入数据，兜底使用本地静态数据
    const matches = matchesData || WORLD_CUP_DATA.matches;

    WORLD_CUP_DATA.teams.forEach(team => {
        if (!standings[team.group]) {
            standings[team.group] = {};
        }
        standings[team.group][team.id] = {
            team: team,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0
        };
    });

    const groupMatches = matches.filter(match => match.stage === 'group' && match.status === 'finished');

    groupMatches.forEach(match => {
        if (!standings[match.group] || !standings[match.group][match.homeTeam] || !standings[match.group][match.awayTeam]) {
            return;
        }

        const home = standings[match.group][match.homeTeam];
        const away = standings[match.group][match.awayTeam];

        home.played++;
        away.played++;
        home.goalsFor += match.homeScore || 0;
        home.goalsAgainst += match.awayScore || 0;
        away.goalsFor += match.awayScore || 0;
        away.goalsAgainst += match.homeScore || 0;
        home.goalDifference = home.goalsFor - home.goalsAgainst;
        away.goalDifference = away.goalsFor - away.goalsAgainst;

        if ((match.homeScore || 0) > (match.awayScore || 0)) {
            home.won++;
            home.points += 3;
            away.lost++;
        } else if ((match.homeScore || 0) < (match.awayScore || 0)) {
            away.won++;
            away.points += 3;
            home.lost++;
        } else {
            home.drawn++;
            away.drawn++;
            home.points += 1;
            away.points += 1;
        }
    });

    Object.keys(standings).forEach(group => {
        const groupTeams = Object.values(standings[group]);
        const groupMatchesFinished = groupMatches.filter(m => m.group === group);

        // 同分时比较相互交锋成绩（H2H）
        function headToHead(a, b) {
            const h2hMatches = groupMatchesFinished.filter(m =>
                (m.homeTeam === a.team.id && m.awayTeam === b.team.id) ||
                (m.homeTeam === b.team.id && m.awayTeam === a.team.id)
            );
            let aPts = 0, bPts = 0, aGD = 0, bGF = 0;
            h2hMatches.forEach(m => {
                const aScore = m.homeTeam === a.team.id ? (m.homeScore || 0) : (m.awayScore || 0);
                const bScore = m.homeTeam === b.team.id ? (m.homeScore || 0) : (m.awayScore || 0);
                if (aScore > bScore) aPts += 3;
                else if (aScore < bScore) bPts += 3;
                else { aPts += 1; bPts += 1; }
                aGD += aScore - bScore;
                bGF += bScore;
            });
            if (bPts !== aPts) return bPts - aPts;
            if (aGD !== (h2hMatches.length > 0 ? -aGD : 0)) {
                let bGD = 0;
                h2hMatches.forEach(m => {
                    const bScore2 = m.homeTeam === b.team.id ? (m.homeScore || 0) : (m.awayScore || 0);
                    const aScore2 = m.homeTeam === a.team.id ? (m.homeScore || 0) : (m.awayScore || 0);
                    bGD += bScore2 - aScore2;
                });
                if (bGD !== aGD) return bGD - aGD;
            }
            return 0;
        }

        // 排序规则：积分 → 净胜球 → 进球数 → 相互交锋 → 队名
        groupTeams.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
            const h2h = headToHead(a, b);
            if (h2h !== 0) return h2h;
            return a.team.name.localeCompare(b.team.name);
        });
        standings[group] = groupTeams;
    });

    return standings;
}

/**
 * 比赛 ID → 比赛对象的索引，用于 O(1) 按 ID 查找
 * @type {Map<number, Object>}
 */
const MATCH_INDEX_BY_ID = new Map();

/**
 * "日期|主队|客队" → 比赛对象的索引，用于 O(1) 按日期和对阵查找
 * 同时存储正序和反序键，以支持主客队顺序无关的查找
 * @type {Map<string, Object>}
 */
const MATCH_INDEX_BY_DATE_TEAMS = new Map();

// 遍历全部比赛，构建 ID 索引和日期对阵索引（正序 + 反序双键）
WORLD_CUP_DATA.matches.forEach(m => {
    MATCH_INDEX_BY_ID.set(m.id, m);
    const key = `${m.date}|${String(m.homeTeam).toUpperCase()}|${String(m.awayTeam).toUpperCase()}`;
    const keyRev = `${m.date}|${String(m.awayTeam).toUpperCase()}|${String(m.homeTeam).toUpperCase()}`;
    MATCH_INDEX_BY_DATE_TEAMS.set(key, m);
    MATCH_INDEX_BY_DATE_TEAMS.set(keyRev, m);
});

/**
 * 队伍 ID 集合，用于 O(1) 判断某 ID 是否为真实参赛队伍（排除 'TBD' 等）
 * @type {Set<string>}
 */
const TEAM_INDEX = new Set(WORLD_CUP_DATA.teams.map(t => t.id));

// 挂载到 window，使 ES Module 可通过 window 访问（const/let 在 script 标签中不会自动成为全局变量）
window.WORLD_CUP_DATA = WORLD_CUP_DATA;
window.MATCH_INDEX_BY_ID = MATCH_INDEX_BY_ID;
window.MATCH_INDEX_BY_DATE_TEAMS = MATCH_INDEX_BY_DATE_TEAMS;
window.TEAM_INDEX = TEAM_INDEX;