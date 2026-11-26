; raster.s split in two for blit.s. The VBL only swaps the buffer pointers (the main loop has already written the
; new screen address) and starts MFP timer A. Its interrupt runs the timed palette writes of raster.s, unchanged
; from .no_swap on and synchronised to the display start by the video counter, so the top border until then
; belongs to the main loop.
; TIMER_A_TICKS: delay at 2.4576 MHz / 50 (163 CPU cycles a tick). The display starts about 17,700 cycles after
; the VBL. The interrupt has to come before that even when the VBL and the timer interrupt both wait for the
; longest Blitter block in HOG mode (about 3,100 cycles each): 58 ticks are about 9,450 cycles.

	ifnd TIMER_A_TICKS
TIMER_A_TICKS equ 58
	endc

spectrum_vbl:
        addq.l  #1,$466.w            ; _frclock, as TOS does
        movem.l d0-d2,-(sp)
        addq.l  #1,vbl_counter
        move.w  pending_view,d0
        bmi.s   .no_swap
        move.l  back_screen,d1
        move.l  front_screen,back_screen
        move.l  d1,front_screen
        move.l  back_palettes,d2
        move.l  front_palettes,back_palettes
        move.l  d2,front_palettes
        move.l  d2,display_palettes_pointer ; the main loop wrote the screen address before this frame began
        move.w  #-1,pending_view
.no_swap:
        clr.b   $fffffa19.w          ; timer A: stop, delay, start
        move.b  #TIMER_A_TICKS,$fffffa1f.w
        move.b  #4,$fffffa19.w       ; delay mode, prescaler 50
        movem.l (sp)+,d0-d2
vbl_end:
        rte

spectrum_raster:
        clr.b   $fffffa19.w          ; one shot
        move.b  #%11011111,$fffffa0f.w ; end of interrupt (ISRA bit 5)
        tst.w   $43e.w
        bne     raster_return
        movem.l d0-d7/a0-a6,-(sp)
        move.w  sr,-(sp)
        move.w  #$2700,sr
        lea     $ffff8240.w,a4
        lea     $ffff8209.w,a5
        lea     delay,a6
        move.l  display_palettes_pointer,a3
        lea     (a4),a0
        rept 8
        move.l  (a3)+,(a0)+
        endr
        move.w  #198,d7
        clr.l   d0
.wait:
        tst.b   (a5)
        beq.s   .wait
        move.b  (a5),d0
        add.l   d0,a6
        jmp     (a6)
delay:
	rept 120

	nop

	endr
	
setcolor:
	nop

	lea		(a4),a0
	lea		(a4),a1
	lea		(a4),a2

	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+

	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+

	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+

	dbf		d7,setcolor

	lea		(a4),a0
	lea		(a4),a1
	lea		(a4),a2
	
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+

	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+

	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+

	nop
	nop

	lea		(a4),a0
	lea		(a4),a1
	lea		(a4),a2
	
	lea		-19040(a3),a4

	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+

	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+

	move.l	(a4)+,(a2)+
	move.l	(a4)+,(a2)+
	move.l	(a4)+,(a2)+
	move.l	(a4)+,(a2)+
	move.l	(a4)+,(a2)+
	move.l	(a4)+,(a2)+
	move.l	(a4)+,(a2)+
	move.l	(a4)+,(a2)+

	move	(sp)+,sr
        movem.l (sp)+,d0-d7/a0-a6

raster_return:
        rte
