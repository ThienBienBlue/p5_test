const Behaviour = {
    player: 0,
    enemy: 1,
    bullet: 2,
};

var game = null;

/**
 * Structure to contain data about a generational index.
 */
class GenerationalIndex
{
    constructor(idx, gen)
    {
        this.idx = idx;
        this.gen = gen;
    }
}

/**
 * Bookkeeper of generational indicies for pooling.
 */
class GenerationalIndexAllocator
{
    constructor()
    {
        this._generation = [];
        this._free_list = [];
    }

    /**
     * :param gidx: Generational Index to query.
     * :returns: Real index of object if exists. -1 otherwise.
     */
    real_idx(gidx)
    {
        const idx = gidx.idx;
        if (idx > this._generation.length)
            return -1;

        if (this._generation[idx] == gidx.gen)
            return idx;

        return -1;
    }

    gen(idx)
    {
        return new GenerationalIndex(idx, this._generation[idx]);
    }

    /**
     * :param gidx: generational index of item to remove.
     */
    dealloc(gidx)
    {
        const real_idx = this.real_idx(gidx);
        if (real_idx == -1)
            return;

        this._free_list.push(real_idx);
        this._generation[real_idx] += 1;
    }

    /**
     * :returns: generational index of newly allocated item.
     */
    alloc()
    {
        if (this._free_list.length > 0)
        {
            const idx = this._free_list.pop();
            const gen = this._generation[idx];
            return new GenerationalIndex(idx, gen);
        }
        else
        {
            const idx = this._generation.length;
            this._generation.push(0);
            return new GenerationalIndex(idx, 0);
        }
    }
}

class GameState
{
    constructor(width, height)
    {
        this._width = width;
        this._height = height;

        this._gidx_alloc = new GenerationalIndexAllocator();

        this._tick = 0;
        this._player = null;

        this._alive = [];
        this._hp = [];
        this._behaviour = [];
        this._xpos = [];
        this._ypos = [];
        this._xvel = [];
        this._yvel = [];
        this._aggro = [];
    }

    /**
     * Updates the generational index and returns an entity to the pool.
     * :param gidx: Generational index of item to restore.
     */
    dealloc(gidx)
    {
        this._gidx_alloc.dealloc(gidx);
        this._alive[gidx.idx] = false;
    }
    
    draw_player(x, y)
    {
        push();
        translate(x, y);
        fill(0, 128, 0);
        rect(-10, -10, 10, 10);
        pop();
    }

    draw_enemy(x, y)
    {
        push();
        translate(x, y);
        fill(210, 105, 30);
        rect(-10, -10, 10, 10);
        pop();
    }
    
    draw_bullet(x, y)
    {
        push();
        translate(x, y);
        fill(255, 255, 0);
        circle(0, 0, 10);
        pop();
    }
    
    render()
    {
        fill(201, 201, 201);
        rect(0, 0, this._width, this._height);
        const len = this._alive.length;
        for (var idx = 0; idx < len; idx += 1)
        {
            if (this._alive[idx] == false)
                continue;

            switch (this._behaviour[idx])
            {
                case Behaviour.enemy: 
                    this.draw_enemy(this._xpos[idx], this._ypos[idx]);
                    break;
                case Behaviour.bullet:
                    this.draw_bullet(this._xpos[idx], this._ypos[idx]);
                    break;
                case Behaviour.player:
                    this.draw_player(this._xpos[idx], this._ypos[idx]);
                    break;
            }
        }
    }

    step()
    {
        if (this._gidx_alloc.real_idx(this._player) == -1)
            return;

        if (this._tick % 420 == 0)
        {
            this.spawn_enemy(Math.random() * this._width, Math.random() * this._height);
            this.spawn_enemy(Math.random() * this._width, Math.random() * this._height);
            this.spawn_enemy(Math.random() * this._width, Math.random() * this._height);
            this.spawn_enemy(Math.random() * this._width, Math.random() * this._height);
        }

        for (var idx = 0; idx < this._alive.length; idx += 1)
        {
            if (this._alive[idx] == false)
                continue;

            switch (this._behaviour[idx])
            {
                case Behaviour.enemy: 
                    this.update_enemy(idx);
                    break;
                case Behaviour.bullet:
                    this.update_bullet(idx);
                    break;
                case Behaviour.player:
                    this.update_player();
                    break;
            }
        }
        this._tick = (this._tick + 1) % 420;
    }

    update_entity(idx, alive, hp, behaviour, x, y, xvel, yvel, aggro)
    {
        this._alive[idx] = alive;
        this._hp[idx] = hp;
        this._behaviour[idx] = behaviour;
        this._xpos[idx] = x;
        this._ypos[idx] = y;
        this._xvel[idx] = xvel;
        this._yvel[idx] = yvel;
        this._aggro[idx] = aggro;
    }

    new_game()
    {
        const gidx = this._gidx_alloc.alloc();
        const idx = gidx.idx;

        this._player = gidx;
        this.update_entity(idx, true, 20, Behaviour.player, this._width / 2,
                this._height / 2, 0, 0, null);
    }
    
    move_player(delta_x, delta_y)
    {
        const idx = this._player.idx;
        this._xpos[idx] += delta_x;
        this._ypos[idx] += delta_y;
    }

    /**
     * The keyTyped functional also updates the player, but this one is rapid.
     * This controls movement as a result.
     */
    update_player()
    {
        if (keyIsDown(87))
            game.move_player(0, -3);
        if (keyIsDown(65))
            game.move_player(-3, 0);
        if (keyIsDown(83))
            game.move_player(0, 3);
        if (keyIsDown(68))
            game.move_player(3, 0);
    }

    spawn_enemy(x, y)
    {
        const gidx = this._gidx_alloc.alloc();
        this.update_entity(gidx.idx, true, 5, Behaviour.enemy, x, y, 0, 0, 
                this._player);
    }

    update_enemy(idx)
    {
        if (this._tick % 42 == 0)
        {
            const aggro = this._aggro[idx];
            var target = this._gidx_alloc.real_idx(aggro);
            if (target == -1)
            {
                this._aggro[idx] = this._player;
                target = this._player;
                target = this._gidx_alloc.real_idx(target);
                console.log(target);
                if (target == -1)
                {
                    this._xvel[idx] = 0;
                    this._yvel[idx] = 0;
                    return;
                }
            }
    
            const xpos = this._xpos[idx];
            const ypos = this._ypos[idx];
    
            const target_x = this._xpos[target];
            const target_y = this._ypos[target];

            if (abs(xpos - target_x) > abs(ypos - target_y))
            {
                const left = (xpos - target_x) > 0;
                if (left)
                {
                    this._xvel[idx] = -3;
                    this._yvel[idx] = 0;
                }
                else 
                {
                    this._xvel[idx] = 3;
                    this._yvel[idx] = 0;
                }
            }
            else
            {
                const up = (ypos - target_y) > 0;
                if (up)
                {
                    this._xvel[idx] = 0;
                    this._yvel[idx] = -3;
                }
                else 
                {
                    this._xvel[idx] = 0;
                    this._yvel[idx] = 3;
                }
            }
        }
        if (this._tick % 21 == 0)
        {
            const aggro = this._aggro[idx];
            if (this._gidx_alloc.real_idx(aggro) == -1)
                return;

            const gidx = this._gidx_alloc.gen(idx);
            const xpos = this._xpos[idx];
            const ypos = this._ypos[idx];

            const bullet_xvel = this._xvel[idx] * 5 / 3;
            const bullet_yvel = this._yvel[idx] * 5 / 3;
            this.spawn_bullet(xpos, ypos, bullet_xvel, bullet_yvel, gidx);
        }
        if (this._tick % 3 == 0)
        {
            this._xpos[idx] += this._xvel[idx];
            this._ypos[idx] += this._yvel[idx];
        }
    }
    
    spawn_bullet(x, y, xvel, yvel, owner)
    {
        const gidx = this._gidx_alloc.alloc();
        this.update_entity(gidx.idx, true, 0, Behaviour.bullet, x, y, xvel, 
                yvel, owner);
    }

    spawn_player_bullet(xvel, yvel)
    {
        const owner = this._player;
        const real_idx = this._gidx_alloc.real_idx(owner);
        const x = this._xpos[real_idx];
        const y = this._ypos[real_idx];
        this.spawn_bullet(x, y, xvel, yvel, owner);
    }
    
    within_bounds(x, y)
    {
        if (0 <= x && x <= this._width
            && 0 <= y && y <= this._height)
        {
            return true;
        }
        return false;
    }

    colliding(x1, y1, x2, y2)
    {
        return (x1 - x2) ** 2 + (y1 - y2) ** 2 < 15 ** 2;
    }

    update_bullet(bullet_idx)
    {
        const xpos = this._xpos[bullet_idx];
        const ypos = this._ypos[bullet_idx];
        if (this.within_bounds(xpos, ypos) == false)
        {
            const gidx = this._gidx_alloc.gen(bullet_idx);
            this.dealloc(gidx);
            return;
        }

        const len = this._alive.length;
        const owner = this._aggro[bullet_idx];
        for (var idx = 0; idx < len; idx += 1)
        {
            if (idx == bullet_idx || this._behaviour[idx] == Behaviour.bullet
                || this._gidx_alloc.real_idx(owner) == idx)
            {
                continue;
            }

            const ent_x = this._xpos[idx];
            const ent_y = this._ypos[idx];

            if (this.colliding(xpos, ypos, ent_x, ent_y))
            {
                const gidx = this._gidx_alloc.gen(bullet_idx);
                this.dealloc(gidx);

                const remaining_hp = this._hp[idx] - 1;
                if (remaining_hp <= 0)
                {
                    const gidx = this._gidx_alloc.gen(idx);
                    this.dealloc(gidx);
                }
                
                this._hp[idx] = remaining_hp;
                this._aggro[idx] = owner;
                return;
            }
        }

        this._xpos[bullet_idx] = xpos + this._xvel[bullet_idx];
        this._ypos[bullet_idx] = ypos + this._yvel[bullet_idx];
    }
}


function keyTyped()
{
    switch (key)
    {
        case 'j':
            game.spawn_player_bullet(-5, 0);
            break;
        case 'l':
            game.spawn_player_bullet(5, 0);
            break;
        case 'i':
            game.spawn_player_bullet(0, -5);
            break;
        case 'k':
            game.spawn_player_bullet(0, 5);
            break;
    }
    return false;
}

function setup()
{
    const width = 1200;
    const height = 600;
    const canvas = createCanvas(width, height);
    game = new GameState(width, height);
    game.new_game();
}

function draw()
{
    game.step();
    game.render();
}