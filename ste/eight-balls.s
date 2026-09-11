; Build the 202-line six-register stream used by the raster. In fidelity mode
; each line uses the closest source-row palette for the frontmost ball crossing it;
; legacy mode copies the original shared palette to every line. The sprite
; indices stay unchanged, so the existing compiled blitters remain intact.
        ifnd COLORED_BALLS
update_fidelity_palettes:
        move.l  back_palettes,a6
        move.w  #201,d7
        tst.w   fidelity_enabled
        beq     .copy_global_lines
        lea     fidelity_line_rows,a5
        moveq   #-1,d0
        rept 51
        move.l  d0,(a5)+
        endr
        lea     balls,a0
        moveq   #7,d4
.ball:
        move.w  2(a0),d0
        lea     fidelity_line_rows,a1
        adda.w  d0,a1
        moveq   #0,d1
        moveq   #31,d2
.ball_row:
        move.b  d1,(a1)
        addq.l  #1,a1
        addq.w  #1,d1
        dbf     d2,.ball_row
        addq.l  #8,a0
        dbf     d4,.ball
        lea     fidelity_line_rows,a5
.line:
        moveq   #0,d5
        move.b  (a5)+,d5
        cmpi.b  #$ff,d5
        beq.s   .global_palette
        ifd RAW_FIDELITY
        lea     raw_row_palettes,a0
        else
        lea     fidelity_row_palettes,a0
        endc
        mulu.w  #12,d5
        adda.w  d5,a0
        bra.s   .copy_palette
.global_palette:
        lea     sprite_palette_stream,a0
.copy_palette:
        move.l  (a0)+,d0
        move.l  (a0)+,d1
        move.l  (a0)+,d2
        move.l  d0,(a6)+
        move.l  d1,(a6)+
        move.l  d2,(a6)+
        move.l  d0,(a6)+
        move.l  d1,(a6)+
        move.l  d2,(a6)+
        move.l  d0,(a6)+
        move.l  d1,(a6)+
        move.l  d2,(a6)+
        dbf     d7,.line
        rts
.copy_global_lines:
        lea     sprite_palette_stream,a0
        move.l  (a0)+,d0
        move.l  (a0)+,d1
        move.l  (a0)+,d2
.global_line:
        move.l  d0,(a6)+
        move.l  d1,(a6)+
        move.l  d2,(a6)+
        move.l  d0,(a6)+
        move.l  d1,(a6)+
        move.l  d2,(a6)+
        move.l  d0,(a6)+
        move.l  d1,(a6)+
        move.l  d2,(a6)+
        dbf     d7,.global_line
        rts

; Raw-fidelity path: source pixels remain 12-bit colors and are mapped through
; a 32-row x 4096-color lookup at draw time. It intentionally favors fidelity
; over speed and is selected only in the EIGHT-RAW build.
draw_ball_raw:
        move.l  back_screen,a6
        lea     raw_sprite_pixels,a0
        lea     fidelity_line_rows,a2
        move.w  #raw_pixel_count-1,d7
.pixel:
        moveq   #0,d0
        move.b  (a0),d0
        add.w   ball_y,d0
        move.w  d0,d1
        mulu.w  #160,d0
        moveq   #0,d2
        move.b  1(a0),d2
        add.w   ball_x,d2
        move.w  d2,d3
        lsr.w   #4,d3
        lsl.w   #3,d3
        add.w   d3,d0
        move.l  a6,a1
        adda.l  d0,a1
        moveq   #0,d4
        move.b  (a2,d1.w),d4
        lsl.l   #8,d4
        lsl.l   #4,d4
        moveq   #0,d5
        move.w  2(a0),d5
        add.l   d5,d4
        lea     raw_palette_lookup,a3
        moveq   #0,d6
        move.b  (a3,d4.l),d6
        addi.w  #10,d6
        move.w  #$8000,d4
        move.w  d2,d5
        andi.w  #15,d5
        lsr.w   d5,d4
        move.w  d4,d5
        not.w   d5
        btst    #0,d6
        beq.s   .clear0
        or.w    d4,0(a1)
        bra.s   .plane1
.clear0:
        and.w   d5,0(a1)
.plane1:
        btst    #1,d6
        beq.s   .clear1
        or.w    d4,2(a1)
        bra.s   .plane2
.clear1:
        and.w   d5,2(a1)
.plane2:
        btst    #2,d6
        beq.s   .clear2
        or.w    d4,4(a1)
        bra.s   .plane3
.clear2:
        and.w   d5,4(a1)
.plane3:
        btst    #3,d6
        beq.s   .clear3
        or.w    d4,6(a1)
        bra.s   .next_pixel
.clear3:
        and.w   d5,6(a1)
.next_pixel:
        addq.l  #4,a0
        dbf     d7,.pixel
        rts

        endc
; Restore every previous footprint before drawing any ball. This ordering is
; essential: restoring one ball after drawing another would erase overlaps.
        ifnd FULL_COLOR
render_balls:
        clr.w   ball_index
.restore:
        bsr     load_ball
        move.w  ball_index,d0
        lsl.w   #2,d0
        move.l  back_positions,a0
        adda.w  d0,a0
        move.w  (a0),back_old_x
        move.w  2(a0),back_old_y
        bsr     restore_ball
        addq.w  #1,ball_index
        cmpi.w  #8,ball_index
        bne.s   .restore
        clr.w   ball_index
.draw:
        bsr     load_ball
        ifd COLORED_BALLS
        bsr     draw_colored_ball
        else
        ifd RAW_FIDELITY
        bsr     draw_ball_raw
        else
        bsr     draw_ball
        tst.w   reuse_enabled
        beq.s   .save
        bsr     reuse_background_colors
        endc
        endc
.save:
        move.w  ball_index,d0
        lsl.w   #2,d0
        move.l  back_positions,a0
        adda.w  d0,a0
        move.w  ball_x,(a0)
        move.w  ball_y,2(a0)
        addq.w  #1,ball_index
        cmpi.w  #8,ball_index
        bne.s   .draw
        rts

        endc
load_ball:
        move.w  ball_index,d0
        lsl.w   #3,d0
        lea     balls,a0
        adda.w  d0,a0
        move.w  (a0),ball_x
        move.w  2(a0),ball_y
        move.w  4(a0),velocity_x
        move.w  6(a0),velocity_y
        rts

move_balls:
        clr.w   ball_index
.next:
        bsr     load_ball
        bsr     move_ball
        move.w  ball_index,d0
        lsl.w   #3,d0
        lea     balls,a0
        adda.w  d0,a0
        move.w  ball_x,(a0)
        move.w  ball_y,2(a0)
        move.w  velocity_x,4(a0)
        move.w  velocity_y,6(a0)
        addq.w  #1,ball_index
        cmpi.w  #8,ball_index
        bne.s   .next
        rts

; Runtime PRNG proves positions are not a prerecorded animation path.
scatter_balls:
        lea     balls,a6
        moveq   #7,d7
.next:
        bsr.s   random_word
        divu.w  #289,d0
        swap    d0
        move.w  d0,(a6)+
        bsr.s   random_word
        divu.w  #168,d0
        swap    d0
        addq.w  #1,d0
        move.w  d0,(a6)+
        bsr.s   random_word
        andi.w  #7,d0
        subq.w  #4,d0
        bne.s   .vx
        moveq   #1,d0
.vx:
        move.w  d0,(a6)+
        bsr.s   random_word
        move.w  d0,d1
        andi.w  #3,d0
        addq.w  #1,d0
        btst    #3,d1
        beq.s   .vy
        neg.w   d0
.vy:
        move.w  d0,(a6)+
        dbf     d7,.next
        rts
random_word:
        moveq   #0,d0
        move.w  random_seed,d0
        lsr.w   #1,d0
        bcc.s   .done
        eori.w  #$b400,d0
.done:
        move.w  d0,random_seed
        rts
