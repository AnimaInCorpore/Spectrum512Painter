; Restore just the two or three planar groups occupied by the old ball.
restore_ball:
        move.w  back_old_y,d0
        bmi     .done
        mulu.w  #160,d0
        move.w  back_old_x,d1
        lsr.w   #4,d1
        lsl.w   #3,d1
        add.w   d1,d0
        lea     limited_screen,a0
        adda.l  d0,a0
        move.l  back_screen,a1
        adda.l  d0,a1
        move.w  back_old_x,d2
        andi.w  #15,d2
        move.w  ball_x,d0
        sub.w   back_old_x,d0
        moveq   #0,d3
        cmpi.w  #-6,d0
        beq.s   .delta_y
        addq.w  #1,d3
        tst.w   d0
        beq.s   .delta_y
        addq.w  #1,d3
        cmpi.w  #6,d0
        bne.s   .general
.delta_y:
        move.w  ball_y,d0
        sub.w   back_old_y,d0
        addq.w  #4,d0
        cmpi.w  #8,d0
        bhi.s   .general
        move.w  d0,d1
        andi.w  #3,d1
        bne.s   .general
        lsr.w   #2,d0
        move.w  d3,d1
        add.w   d3,d3
        add.w   d1,d3
        add.w   d3,d0
        lsl.w   #4,d0
        add.w   d2,d0
        lsl.w   #2,d0
        lea     overlap_restorers,a2
        move.l  (a2,d0.w),a2
        jmp     (a2)
.general:
        tst.w   d2
        beq     .aligned
restore_row set 0
        rept 32
        movem.l restore_row*160(a0),d0-d5
        movem.l d0-d5,restore_row*160(a1)
restore_row set restore_row+1
        endr
        rts
.aligned:
restore_row set 0
        rept 32
        movem.l restore_row*160(a0),d0-d3
        movem.l d0-d3,restore_row*160(a1)
restore_row set restore_row+1
        endr
.done:
        rts

; Specialized blitters omit transparent pixels and directly write opaque groups.
        ifnd FULL_COLOR
draw_ball:
        move.w  ball_x,d0
        andi.w  #15,d0
        lsl.w   #2,d0
        lea     sprite_drawers,a0
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

        endc
write_ball_palette:
        move.w  #201,d0
        sub.w   ball_y,d0
        mulu.w  #36,d0
        addi.l  #sprite_palette_stream,d0
        move.l  d0,back_palettes
        rts

; Sparse precomputed XOR corrections borrow closer background colors. Packed
; byte records allow odd addresses; never read a word/long from the patch stream.
        ifnd COLORED_BALLS
reuse_background_colors:
        move.w  ball_y,d0
        subq.w  #1,d0
        mulu.w  #289,d0
        moveq   #0,d1
        move.w  ball_x,d1
        add.l   d1,d0
        lsl.l   #2,d0
        lea     reuse_index,a0
        adda.l  d0,a0
        move.l  (a0),d0
        lea     reuse_patches,a2
        adda.l  d0,a2
        move.w  ball_y,d0
        mulu.w  #160,d0
        lsr.w   #4,d1
        lsl.w   #3,d1
        add.w   d1,d0
        move.l  back_screen,a6
        adda.l  d0,a6
        lea     reuse_group_offsets,a3
        lea     reuse_code,a4
        lea     .next,a5
.next:
        moveq   #0,d5
        move.b  (a2)+,d5
        cmpi.b  #255,d5
        beq.s   .done
        move.w  d5,d0
        andi.w  #127,d0
        add.w   d0,d0
        move.w  (a3,d0.w),d1
        lea     (a6,d1.w),a1
        moveq   #0,d0
        move.b  (a2)+,d0
        lsl.w   #8,d0
        move.b  (a2)+,d0
        lsl.l   #4,d0
        tst.b   d5
        bpl.s   .low
        addi.l  #65536*16,d0
.low:
        move.l  a4,a0
        adda.l  d0,a0
        jmp     (a0)
.done:
        rts

        endc
move_ball:
        move.w  velocity_x,d0
        add.w   d0,ball_x
        cmpi.w  #288,ball_x
        bls.s   .y
        neg.w   velocity_x
        sub.w   d0,ball_x
        move.w  velocity_x,d0
        add.w   d0,ball_x
.y:
        move.w  velocity_y,d0
        add.w   d0,ball_y
        cmpi.w  #1,ball_y
        blt.s   .bounce
        cmpi.w  #168,ball_y
        ble.s   .done
.bounce:
        neg.w   velocity_y
        sub.w   d0,ball_y
        move.w  velocity_y,d0
        add.w   d0,ball_y
.done:
        rts
