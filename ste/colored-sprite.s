; Select one of eight sets of sixteen compiled masked sprite blitters.
draw_colored_ball:
        move.w  ball_index,d0
        lsl.w   #2,d0
        lea     colored_drawers,a0
        move.l  (a0,d0.w),a0
        move.w  ball_x,d0
        andi.w  #15,d0
        lsl.w   #2,d0
        move.l  (a0,d0.w),a0
        move.w  ball_y,d0
        mulu.w  #160,d0
        move.w  ball_x,d1
        lsr.w   #4,d1
        lsl.w   #3,d1
        add.w   d1,d0
        move.l  back_screen,a1
        adda.l  d0,a1
        jmp     (a0)
