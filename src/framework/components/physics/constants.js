/**
 * @typedef {typeof BODYTYPE_STATIC | typeof BODYTYPE_KINEMATIC | typeof BODYTYPE_DYNAMIC} PhysicsBodyType
 */

/**
 * Physics body has infinite mass and cannot move.
 *
 * @type {string}
 */
export const BODYTYPE_STATIC = 'static';

/**
 * Physics body is simulated according to applied forces.
 *
 * @type {string}
 */
export const BODYTYPE_DYNAMIC = 'dynamic';

/**
 * Physics body has infinite mass and does not respond to forces but can still be moved by setting
 * their velocity or position.
 *
 * @type {string}
 */
export const BODYTYPE_KINEMATIC = 'kinematic';

// groups
export const BODYGROUP_INDEX_DYNAMIC = 0;
export const BODYGROUP_INDEX_STATIC = 1;
export const BODYGROUP_INDEX_KINEAMTIC = 2;
export const BODYGROUP_INDEX_ENGINE_1 = 3;
export const BODYGROUP_INDEX_TRIGGER = 4;
export const BODYGROUP_INDEX_ENGINE_2 = 5;
export const BODYGROUP_INDEX_ENGINE_3 = 6;
export const BODYGROUP_INDEX_USER_1 = 7;
export const BODYGROUP_INDEX_USER_2 = 8;
export const BODYGROUP_INDEX_USER_3 = 9;
export const BODYGROUP_INDEX_USER_4 = 10;
export const BODYGROUP_INDEX_USER_5 = 11;
export const BODYGROUP_INDEX_USER_6 = 12;
export const BODYGROUP_INDEX_USER_7 = 13;
export const BODYGROUP_INDEX_USER_8 = 14;
export const BODYGROUP_INDICES_COUNT = 15;

export const BODYGROUP_NONE = 0;
export const BODYGROUP_DYNAMIC = 1 << BODYGROUP_INDEX_DYNAMIC;
export const BODYGROUP_DEFAULT = BODYGROUP_DYNAMIC;
export const BODYGROUP_STATIC = 1 << BODYGROUP_INDEX_STATIC;
export const BODYGROUP_KINEMATIC = 1 << BODYGROUP_INDEX_KINEAMTIC;
export const BODYGROUP_ENGINE_1 = 1 << BODYGROUP_INDEX_ENGINE_1;
export const BODYGROUP_TRIGGER = 1 << BODYGROUP_INDEX_TRIGGER;
export const BODYGROUP_ENGINE_2 = 1 << BODYGROUP_INDEX_ENGINE_2;
export const BODYGROUP_ENGINE_3 = 1 << BODYGROUP_INDEX_ENGINE_3;
export const BODYGROUP_USER_1 = 1 << BODYGROUP_INDEX_USER_1;
export const BODYGROUP_USER_2 = 1 << BODYGROUP_INDEX_USER_2;
export const BODYGROUP_USER_3 = 1 << BODYGROUP_INDEX_USER_3;
export const BODYGROUP_USER_4 = 1 << BODYGROUP_INDEX_USER_4;
export const BODYGROUP_USER_5 = 1 << BODYGROUP_INDEX_USER_5;
export const BODYGROUP_USER_6 = 1 << BODYGROUP_INDEX_USER_6;
export const BODYGROUP_USER_7 = 1 << BODYGROUP_INDEX_USER_7;
export const BODYGROUP_USER_8 = 1 << BODYGROUP_INDEX_USER_8;

// masks
export const BODYMASK_NONE = 0;
export const BODYMASK_ALL = 65535;
export const BODYMASK_STATIC = BODYGROUP_STATIC;
export const BODYMASK_NOT_STATIC = BODYMASK_ALL ^ BODYGROUP_STATIC;
export const BODYMASK_NOT_STATIC_KINEMATIC = BODYMASK_ALL ^ (BODYGROUP_STATIC | BODYGROUP_KINEMATIC);
