; Same 60 Hz / 8 MHz palette-write schedule as raster.s, with separate sources
; for registers 0..9 and 10..15. Each write remains MOVE.L (An)+,(An)+.
spectrum_vbl:
        tst.w   $43e.w
        bne     raster_return
        movem.l d0-d7/a0-a6,-(sp)
        move.w  sr,-(sp)
        move.w  #$2700,sr
        addq.l  #1,vbl_counter
        move.w  pending_view,d0
        bmi.s   .no_swap
        move.l  back_screen,d1
        move.l  front_screen,back_screen
        move.l  d1,front_screen
        move.l  back_palettes,d2
        move.l  front_palettes,back_palettes
        move.l  d2,front_palettes
        move.l  d2,display_palettes_pointer
        ifd EIGHT_BALLS
        move.l  back_positions,d2
        move.l  front_positions,back_positions
        move.l  d2,front_positions
        else
        move.w  back_old_y,d2
        move.w  front_old_y,back_old_y
        move.w  d2,front_old_y
        endc
        move.b  d1,$ffff820d.w
        lsr.l   #8,d1
        move.b  d1,$ffff8203.w
        lsr.l   #8,d1
        move.b  d1,$ffff8201.w
        move.w  #-1,pending_view
.no_swap:
        lea     $ffff8240.w,a4
        lea     $ffff8209.w,a5
        lea     limited_palettes,a3
        move.l  display_palettes_pointer,a6
        lea     (a4),a0
        rept 5
        move.l  (a3)+,(a0)+
        endr
        rept 3
        move.l  (a6)+,(a0)+
        endr
        move.l  a6,display_sprite_tail
        lea     delay,a6
        move.w  #198,d7
        clr.l   d0
.wait:
        tst.b   (a5)
        beq.s   .wait
        move.b  (a5),d0
        add.l   d0,a6
        jmp     (a6)
delay:
        rept 115
        nop
        endr
        ; 20 cycles replace the final five NOPs. The variable jump lands only
        ; in the preceding NOP area; A5 is no longer needed for synchronization.
        move.l  display_sprite_tail,a5
setcolor:
        nop
        lea     (a4),a0
        lea     (a4),a1
        lea     (a4),a2
        rept 5
        move.l  (a3)+,(a0)+
        endr
        rept 3
        move.l  (a5)+,(a0)+
        endr
        rept 5
        move.l  (a3)+,(a1)+
        endr
        rept 3
        move.l  (a5)+,(a1)+
        endr
        rept 5
        move.l  (a3)+,(a2)+
        endr
        rept 3
        move.l  (a5)+,(a2)+
        endr
        dbf     d7,setcolor
        lea     (a4),a0
        lea     (a4),a1
        lea     (a4),a2
        rept 5
        move.l  (a3)+,(a0)+
        endr
        rept 3
        move.l  (a5)+,(a0)+
        endr
        rept 5
        move.l  (a3)+,(a1)+
        endr
        rept 3
        move.l  (a5)+,(a1)+
        endr
        rept 5
        move.l  (a3)+,(a2)+
        endr
        rept 3
        move.l  (a5)+,(a2)+
        endr
        nop
        nop
        lea     (a4),a0
        lea     (a4),a1
        lea     (a4),a2
        lea     -11900(a3),a4
        rept 5
        move.l  (a3)+,(a0)+
        endr
        rept 3
        move.l  (a5)+,(a0)+
        endr
        rept 5
        move.l  (a3)+,(a1)+
        endr
        rept 3
        move.l  (a5)+,(a1)+
        endr
        rept 5
        move.l  (a4)+,(a2)+
        endr
        rept 3
        move.l  (a5)+,(a2)+
        endr
        move.w  (sp)+,sr
        movem.l (sp)+,d0-d7/a0-a6
raster_return:
        rts
