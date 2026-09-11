; Select a precomputed planar source row for the current shared palette, then
; shift its mask and four planes to the ball's arbitrary pixel position.
draw_full_ball:
        move.w  ball_index,d0
        lsl.w   #7,d0
        move.w  d0,full_ball_offset
        move.w  ball_x,d0
        andi.w  #15,d0
        move.w  d0,d1
        lsl.w   #2,d0
        lea     full_drawers,a0
        move.l  (a0,d0.w),full_drawer
        mulu.w  #192,d1
        lea     full_shift_masks,a5
        adda.w  d1,a5
        move.w  ball_y,d0
        lea     full_line_families,a4
        adda.w  d0,a4
        mulu.w  #160,d0
        move.w  ball_x,d1
        lsr.w   #4,d1
        lsl.w   #3,d1
        add.w   d1,d0
        move.l  back_screen,a6
        adda.l  d0,a6
        moveq   #0,d7
.row:
        moveq   #0,d0
        move.b  (a4)+,d0
        lsl.l   #8,d0
        lsl.l   #2,d0
        add.w   full_ball_offset,d0
        move.w  d7,d1
        lsl.w   #2,d1
        add.w   d1,d0
        lea     full_sprite_index,a0
        adda.l  d0,a0
        move.l  (a0),d0
        lea     full_sprite_rows,a0
        adda.l  d0,a0
        move.w  (a5)+,d3
        move.w  (a5)+,d4
        move.w  (a5)+,d5
        move.l  a6,a1
        move.l  full_drawer,a2
        jsr     (a2)
        adda.w  #160,a6
        addq.w  #1,d7
        cmpi.w  #32,d7
        bne.s   .row
        rts
