init_full_palettes:
        lea     sprite_palette_stream,a0
        move.l  front_palettes,a1
        move.l  back_palettes,a2
        move.w  #202*24-1,d0
.copy:
        move.l  (a0)+,d1
        move.l  d1,(a1)+
        move.l  d1,(a2)+
        dbf     d0,.copy
        rts

render_full_frame:
        bsr     select_full_families
        bsr     restore_full_background
        clr.w   ball_index
.ball:
        bsr     load_ball
        bsr     draw_full_ball
        move.w  ball_index,d0
        lsl.w   #2,d0
        move.l  back_positions,a0
        adda.w  d0,a0
        move.w  ball_x,(a0)
        move.w  ball_y,2(a0)
        addq.w  #1,ball_index
        cmpi.w  #8,ball_index
        bne.s   .ball
        rts

; Source mask has opaque rows 1..29. Each ball contributes its color bit to
; those screen lines; four or more hues select the universal eight-hue family.
select_full_families:
        lea     full_line_masks,a0
        moveq   #0,d0
        rept 50
        move.l  d0,(a0)+
        endr
        lea     balls,a0
        moveq   #1,d1
        moveq   #7,d7
.ball:
        move.w  2(a0),d0
        addq.w  #1,d0
        lea     full_line_masks,a1
        adda.w  d0,a1
        rept 29
        or.b    d1,(a1)+
        endr
        add.w   d1,d1
        addq.l  #8,a0
        dbf     d7,.ball
        ; Keep the previous footprint's hue on the line for one more frame.
        ; A ball moving vertically otherwise changes two full-width palette
        ; rows at once (one entering and one leaving), which is perceived as
        ; a horizontal flicker even though the sprite itself is double-buffered.
        ; The old footprint is already the screen we are about to restore, so
        ; including it costs only another 8*29 byte OR pass and keeps the
        ; transition to the baseline palette to one row per frame.
        move.l  back_positions,a0
        moveq   #1,d1
        moveq   #7,d7
.old_ball:
        move.w  2(a0),d0
        cmpi.w  #1,d0
        bcs.s   .old_next
        cmpi.w  #168,d0
        bhi.s   .old_next
        addq.w  #1,d0
        lea     full_line_masks,a1
        adda.w  d0,a1
        rept 29
        or.b    d1,(a1)+
        endr
.old_next:
        add.w   d1,d1
        addq.l  #4,a0
        dbf     d7,.old_ball
        lea     full_line_masks,a0
        lea     full_family_lookup,a1
        lea     full_line_families,a2
        move.w  #199,d7
.line:
        moveq   #0,d0
        move.b  (a0)+,d0
        move.b  (a1,d0.w),(a2)+
        dbf     d7,.line
        rts

; Restore complete affected rows from cached background images, remapped to
; the same palette as all balls on that line. Unaffected rows remain untouched.
restore_full_background:
        lea     full_line_families+1,a3
        lea     full_history0+1,a4
        move.l  back_screen,a5
        cmpa.l  screen_base,a5
        beq.s   .history
        lea     full_history1+1,a4
.history:
        adda.w  #160,a5
        move.l  back_palettes,a6
        moveq   #1,d7
.line:
        moveq   #0,d5
        move.b  (a3)+,d5
        bne.s   .restore
        tst.b   (a4)
        beq     .next
.restore:
        move.l  d5,d0
        mulu.w  #32000,d0
        move.w  d7,d6
        mulu.w  #160,d6
        add.l   d6,d0
        lea     full_backgrounds,a0
        adda.l  d0,a0
        move.l  a5,a1
        rept 40
        move.l  (a0)+,(a1)+
        endr
        move.l  a6,a1
        tst.w   d5
        beq.s   .baseline
        move.w  d5,d0
        lsl.w   #5,d0
        lea     full_palettes,a0
        adda.w  d0,a0
        rept 3
        rept 8
        move.l  (a0)+,(a1)+
        endr
        lea     -32(a0),a0
        endr
        bra.s   .next
.baseline:
        move.w  d7,d0
        subq.w  #1,d0
        mulu.w  #96,d0
        lea     sprite_palette_stream,a0
        adda.w  d0,a0
        rept 24
        move.l  (a0)+,(a1)+
        endr
.next:
        move.b  d5,(a4)+
        adda.w  #160,a5
        adda.w  #96,a6
        addq.w  #1,d7
        cmpi.w  #200,d7
        bne     .line
        rts
